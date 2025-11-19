import { Logger } from '@adonisjs/core/logger'
import { WebhookRequestDto } from '#mobile/webhooks/dto/webhook_request.dto'
import { WebhookResponseDto } from '#mobile/webhooks/dto/webhook_response.dto'
import { Exception } from '@adonisjs/core/exceptions'
import Transaction, { TransactionStatus } from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

/**
 * Abstract class representing the base structure for handling webhook use cases.
 * Provides common methods and utilities for validating payloads, processing entities,
 * and managing idempotent requests and responses.
 */
export default abstract class BaseWebhookUseCase {
  /**
   * Protected constructor for initializing the class with required dependencies.
   *
   * @param {PaymentService} paymentService - Service responsible for handling payment operations.
   * @param {TransactionService} transactionService - Service responsible for managing transaction operations.
   * @param {Logger} logger - Logger instance for logging application events.
   */
  protected constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService,
    protected readonly logger: Logger
  ) {}

  /**
   * Executes the processing of a webhook request, handling transactions, payments, and wallets while ensuring idempotency and error handling.
   *
   * @param {WebhookRequestDto} payload - The webhook request payload containing necessary data for processing.
   * @param {'success' | 'failed'} status - The result status of the webhook, indicating either a 'success' or 'failed' state.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to a response object indicating the result of the webhook processing.
   */
  async execute(
    payload: WebhookRequestDto,
    status: 'success' | 'failed'
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const reference = payload.data.reference!

    this.logger.info({ reference, status }, `Processing ${this.getKind()} webhook`)

    const trx = await db.transaction()
    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(reference)

      this.logger.debug(
        {
          reference,
          transaction_id: transaction.id,
          payment_id: payment.id,
          wallet_id: wallet.id,
          transaction_status: transaction.status,
          payment_status: payment.status,
        },
        `Loaded entities for ${this.getKind()} webhook`
      )

      if (this.isIdempotentRequest(transaction, payment, status)) {
        this.logger.warn(
          {
            reference,
            transaction_status: transaction.status,
            payment_status: payment.status,
            incoming_status: status,
          },
          'Idempotent webhook call — skipping processing'
        )
        await trx.rollback()
        return this.createIdempotentResponse(reference, transaction.status)
      }

      await this.processWebhook(transaction, payment, wallet, payload, status, trx)
      await trx.commit()
      this.logger.info({ reference, status }, `${this.getKind()} webhook processed successfully`)
      return this.createSuccessResponse(reference, status)
    } catch (error) {
      await trx.rollback()
      this.logger.error(
        {
          status: (error as any).status || 500,
          data: (error as any).data || {},
          reference,
          err: error,
        },
        (error as any).message || `${this.getKind()} webhook processing error`
      )
      throw error
    }
  }

  /**
   * Validates the given payload object to ensure required properties are present.
   *
   * @param {WebhookRequestDto} payload - The payload object received in the webhook request.
   * @throws {Exception} Throws an exception if the `reference` property is missing in the `data` field of the payload object.
   * @return {void}
   */
  protected validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      throw new Exception('Reference manquante dans le webhook', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }
  }

  /**
   * Asynchronously loads the required entities based on the provided reference.
   *
   * @param {string} reference - The unique reference to identify the transaction and related entities.
   * @return {Promise<{transaction: Transaction, payment: Payment, wallet: Wallet}>} A promise that resolves with the required entities: transaction, payment, and wallet.
   * @throws {Exception} Throws an exception if no payment is found for the transaction or if the wallet cannot be located.
   */
  protected async loadRequiredEntities(
    reference: string
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await this.transactionService.findByReference(reference)

    const [payments, wallet] = await Promise.all([
      this.paymentService.findByTransaction(transaction.transactionsUid || transaction.id),
      this.getWalletForTransaction(transaction),
    ])

    if (payments.length === 0) {
      throw new Exception('Paiement introuvable pour cette transaction', {
        status: 404,
        code: 'PAYMENT_NOT_FOUND',
      })
    }

    const payment = payments[0]
    return { transaction, payment, wallet }
  }

  /**
   * Determines if the request is idempotent based on the incoming transaction status
   * and the current transaction and payment statuses.
   *
   * @param {Transaction} transaction - The existing transaction details including its current status.
   * @param {Payment} payment - The associated payment details including its current status.
   * @param {TransactionStatus} incomingStatus - The status of the incoming transaction request (e.g. 'success', 'failed').
   * @return {boolean} Returns true if the request is idempotent, false otherwise.
   */
  protected isIdempotentRequest(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    const isIncomingSuccess = incomingStatus === 'success'
    const isCurrentSuccess = transaction.status === 'success' || payment.status === 'success'
    const isCurrentFailed = transaction.status === 'failed' || payment.status === 'failed'
    return (isIncomingSuccess && isCurrentSuccess) || (!isIncomingSuccess && isCurrentFailed)
  }

  /**
   * Creates an idempotent webhook response indicating that the request has already been processed.
   *
   * @param {string} reference - A unique identifier for the request.
   * @param {string} currentStatus - The current status associated with the reference.
   * @return {WebhookResponseDto} An object containing the idempotent response message and associated data.
   */
  protected createIdempotentResponse(reference: string, currentStatus: string): WebhookResponseDto {
    return {
      status: true,
      message: 'Déjà traité — idempotent',
      data: { reference, result: currentStatus },
    }
  }

  /**
   * Creates a success response object for a webhook.
   *
   * @param {string} reference - The reference identifier for the webhook.
   * @param {string} status - The status result of the webhook process.
   * @return {WebhookResponseDto} An object containing the status, message, and processed data.
   */
  protected createSuccessResponse(reference: string, status: string): WebhookResponseDto {
    return {
      status: true,
      message: 'Webhook traité',
      data: { reference, result: status },
    }
  }

  /**
   * Marks a payment as successful in a safe manner. If the payment has already been
   * marked as successful, it logs the occurrence and skips without throwing an error.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as successful.
   * @param {any} operatorResponse - The response data from the payment operator.
   * @param {TransactionClientContract} trx - The transaction context used to ensure atomicity.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  protected async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_SUCCESSFUL') throw error
      this.logger.info({ payment_id: paymentId }, 'Payment already successful, skipping')
    }
  }

  /**
   * Marks a transaction as successful in a safe manner by handling potential conflicts.
   * If the transaction has already been marked as successful, the error is logged, and the operation is skipped.
   *
   * @param {number} transactionId The unique identifier of the transaction to be marked as successful.
   * @param {number} balance The balance associated with the transaction.
   * @param {TransactionClientContract} trx The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the transaction has been marked as successful or skips if already successful.
   */
  protected async safeMarkTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markSuccess(transactionId, balance, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_SUCCESSFUL') throw error
      this.logger.info(
        { transaction_id: transactionId },
        'Transaction already successful, skipping'
      )
    }
  }

  /**
   * Safely attempts to mark a transaction as failed in the transaction service.
   * If the transaction has already been marked as failed, it logs the event and skips further processing.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The database transaction client used for executing the operation.
   * @return {Promise<void>} A Promise that resolves when the operation is complete.
   */
  protected async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') throw error
      this.logger.info({ transaction_id: transactionId }, 'Transaction already failed, skipping')
    }
  }
  /**
   * Safely marks a payment as failed by interacting with the payment service. Prevents re-processing if the payment is already marked as failed.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response object or details related to the failure from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client to manage database transactions.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  protected async safeMarkPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markFailed(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_FAILED') throw error
      this.logger.info({ payment_id: paymentId }, 'Payment already failed, skipping')
    }
  }

  /**
   * Abstract method to retrieve the wallet associated with a specific transaction.
   *
   * @param {Transaction} transaction - The transaction for which the wallet is required.
   * @return {Promise<Wallet>} A promise that resolves to the wallet corresponding to the given transaction.
   */
  protected abstract getWalletForTransaction(transaction: Transaction): Promise<Wallet>

  /**
   * Retrieves the kind of operation.
   * This method must be implemented by subclasses and should return a string
   * representing the type of operation, such as 'deposit', 'transfer', or any other type.
   *
   * @return {('deposit' | 'transfer' | string)} The kind of operation.
   */
  protected abstract getKind(): 'deposit' | 'transfer' | string

  /**
   * Processes a webhook request and updates the corresponding transaction, payment, and wallet information.
   *
   * @param {Transaction} transaction - The transaction object associated with the webhook.
   * @param {Payment} payment - The payment object related to the transaction.
   * @param {Wallet} wallet - The wallet object linked to the payment or transaction.
   * @param {WebhookRequestDto} payload - The payload received from the webhook request.
   * @param {string} status - The status derived from the webhook payload or processing logic.
   * @param {TransactionClientContract} trx - The transaction client contract used for database operations.
   * @return {Promise<void>} A promise that resolves when the webhook processing is completed.
   */
  protected abstract processWebhook(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    payload: WebhookRequestDto,
    status: string,
    trx: TransactionClientContract
  ): Promise<void>
}
