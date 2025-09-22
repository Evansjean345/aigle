import { inject } from '@adonisjs/core'
import PaymentService from '#shared/services/payment_service'
import TransactionService from '#shared/services/transaction_service'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction, { TransactionStatus } from '#shared/models/transaction'
import Payment from '#shared/models/payment'
import Wallet from '#shared/models/wallet'
import { WebhookRequestDto } from '#mobile/webhooks/dto/webhook_request.dto'
import { WebhookResponseDto } from '#mobile/webhooks/dto/webhook_response.dto'
import { Logger } from '@adonisjs/core/logger'
import WalletService from '#mobile/wallet/services/wallet_service'

/**
 * Handles the business logic for processing transfer webhook events. Mirrors the deposit webhook flow
 * but adapts wallet movements to transfer semantics (wallet is debited at initiation, refunded on failure).
 */
@inject()
export default class HandleTransfertWebhookUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly logger: Logger
  ) {}

  async execute(
    payload: WebhookRequestDto,
    status: 'success' | 'failed'
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference } = payload.data

    this.logger.info({ reference, status }, 'Processing transfer webhook')

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
        'Loaded entities for transfer webhook'
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
      this.logger.info({ reference, status }, 'Transfer webhook processed successfully')
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
        (error as any).message || 'Transfer webhook processing error'
      )
      throw error
    }
  }

  /**
   * Validates the provided webhook request payload to ensure all required properties are present.
   *
   * @param {WebhookRequestDto} payload - The webhook request payload to be validated.
   * @return {void} This method does not return a value but throws an exception if validation fails.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      throw new Exception('Reference manquante dans le webhook', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }
  }

  /**
   * Loads the required entities based on the provided reference.
   *
   * @param {string} reference - The reference used to identify the transaction and related entities.
   * @return {Promise<{transaction: Transaction, payment: Payment, wallet: Wallet}>} A promise that resolves with an object containing the transaction, payment, and wallet entities.
   * @throws {Exception} If no payment is found for the transaction, an exception is thrown with a status of 404 and code 'PAYMENT_NOT_FOUND'.
   */
  private async loadRequiredEntities(
    reference: string
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await this.transactionService.findByReference(reference)

    const [payments, wallet] = await Promise.all([
      this.paymentService.findByTransaction(transaction.transactions_uid || transaction.id),
      this.walletService.getByUserId(transaction.users_uid),
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
   * Determines if a request is idempotent based on the current transaction, payment, and incoming transaction status.
   *
   * @param {Transaction} transaction - The current transaction object containing the status.
   * @param {Payment} payment - The payment object containing the status.
   * @param {TransactionStatus} incomingStatus - The status of the incoming transaction.
   * @return {boolean} Returns true if the request is idempotent, otherwise false.
   */
  private isIdempotentRequest(
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
   * Processes a webhook for a transaction, determining success or failure
   * and delegating to appropriate transfer handling methods.
   *
   * @param {Transaction} transaction - The transaction associated with the webhook.
   * @param {Payment} payment - The payment object related to the transaction.
   * @param {Wallet} wallet - The wallet involved in the transaction.
   * @param {WebhookRequestDto} payload - The data payload received from the webhook.
   * @param {string} status - The status of the transaction, indicating success or failure.
   * @param {TransactionClientContract} trx - The transaction client instance for database operations.
   * @return {Promise<void>} Resolves when the webhook processing is complete.
   */
  private async processWebhook(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    payload: WebhookRequestDto,
    status: string,
    trx: TransactionClientContract
  ): Promise<void> {
    const operatorResponse = { operator_response: payload as any }

    this.logger.debug(
      {
        reference: payload.data.reference,
        transaction_id: transaction.id,
        payment_id: payment.id,
        wallet_id: wallet.id,
        status,
      },
      'Processing transfer webhook body'
    )

    if (status === 'success') {
      await this.processSuccessfulTransfer(transaction, payment, wallet, operatorResponse, trx)
    } else {
      await this.processFailedTransfer(transaction, payment, wallet, operatorResponse, trx)
    }
  }

  /**
   * Handles the processing of a successful transfer by marking the payment and transaction as successful.
   *
   * @param {Transaction} transaction - The transaction object related to the transfer.
   * @param {Payment} payment - The payment object associated with the transfer.
   * @param {Wallet} wallet - The wallet object containing the current balance.
   * @param {any} operatorResponse - The response from the operator regarding the transfer.
   * @param {TransactionClientContract} trx - The database transaction client for ensuring atomic operations.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async processSuccessfulTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    // mark payment success
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)
    // mark transaction success with current wallet balance (no change here)
    await this.safeMarkTransactionSuccess(transaction.id, Number(wallet.balance), trx)
  }

  /**
   * On transfer failure, mark payment/transaction failed and refund wallet by the net debited amount (transaction.amount).
   */
  private async processFailedTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    // mark both failed first
    await Promise.all([
      this.safeMarkTransactionFailed(transaction.id, trx),
      this.safeMarkPaymentFailed(payment.id, operatorResponse, trx),
    ])

    // refund wallet (credit back the debited net amount)
    const refunded = await this.walletService.creditBalance(
      wallet.id,
      Number(transaction.amount || 0),
      trx
    )

    if (!refunded) {
      throw new Exception('Echec de remboursement du wallet', {
        status: 500,
        code: 'WALLET_REFUND_FAILED',
      })
    }
  }

  /**
   * Safely marks a payment as successful by invoking the payment service.
   * Logs and skips the operation if the payment is already marked as successful.
   *
   * @param {number} paymentId - The unique identifier of the payment to mark as successful.
   * @param {any} operatorResponse - The response object received from an external operator containing details about the payment.
   * @param {TransactionClientContract} trx - The transaction client used for handling database transactions.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  private async safeMarkPaymentSuccess(
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
   * Safely marks a transaction as successful while handling potential errors for already successful transactions.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction.
   * @param {TransactionClientContract} trx - The transaction client context for database operations.
   * @return {Promise<void>} Resolves when the operation completes successfully or skips if already successful.
   */
  private async safeMarkTransactionSuccess(
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
   * Marks a transaction as failed in a safe manner, ensuring that specific errors are handled gracefully.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   */
  private async safeMarkTransactionFailed(
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
   * Attempts to mark a payment as failed safely by handling potential errors.
   * If the payment has already been marked as failed, the error is logged and skipped.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response or metadata from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client used to perform the database operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async safeMarkPaymentFailed(
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
   * Generates an idempotent response object documenting the current status of a given reference.
   *
   * @param {string} reference - The unique reference identifier for which the response is created.
   * @param {string} currentStatus - The current status associated with the provided reference.
   * @return {WebhookResponseDto} The idempotent response object containing the status, message, and data.
   */
  private createIdempotentResponse(reference: string, currentStatus: string): WebhookResponseDto {
    return {
      status: true,
      message: 'Déjà traité — idempotent',
      data: {
        reference,
        result: currentStatus,
      },
    }
  }

  /**
   * Creates a standardized success response for a webhook.
   *
   * @param {string} reference - The unique reference identifier associated with the webhook.
   * @param {string} status - The status result of the webhook processing.
   * @return {WebhookResponseDto} An object representing the success response, including the status, message, and associated data.
   */
  private createSuccessResponse(reference: string, status: string): WebhookResponseDto {
    return {
      status: true,
      message: 'Webhook traité',
      data: {
        reference,
        result: status,
      },
    }
  }
}
