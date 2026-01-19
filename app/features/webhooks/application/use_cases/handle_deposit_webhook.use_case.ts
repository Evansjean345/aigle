import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import LedgerService from '#features/ledger/application/services/ledger_service'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import DepositTransactionFailed, {
  DepositTransactionFailedPayload,
} from '#features/webhooks/application/events/deposit/deposit_transaction_failed'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

/**
 * Handles the business logic for processing deposit webhook events. This class is responsible for managing
 * transaction updates, payment state, and wallet adjustments based on incoming webhook payloads.
 */
@inject()
export default class HandleDepositWebhookUseCase {
  /**
   * Constructor for initializing dependencies required for transaction management and payment processing.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment operations.
   * @param {TransactionService} transactionService - The service for managing transaction-related business logic.
   * @param {WalletRepository} walletRepository - The repository for accessing wallet-related data and operations.
   * @param ledgerService
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletRepository: WalletRepository,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Executes the deposit webhook process based on the provided payload and status.
   *
   * @param {WebhookRequestDto} payload - The payload containing deposit webhook data to be processed.
   * @param {'success' | 'failed'} status - The status of the webhook, determining how to process the request.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to the result of the webhook execution.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference: webTransactionRef } = payload.data

    transactionLog.info(
      'DEPOSIT_WEBHOOK_PROCESSING',
      { webhook: { reference: webTransactionRef, status } },
      'Processing deposit webhook'
    )

    const trx = await db.transaction()

    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(webTransactionRef)

      transactionLog.debug(
        'DEPOSIT_ENTITIES_LOADED',
        {
          webhook: { reference: webTransactionRef },
          transaction: { id: transaction.id, status: transaction.status },
          payment: { id: payment.id, status: payment.status },
          wallet: { id: wallet.id },
        },
        'Loaded entities for deposit webhook'
      )

      if (this.isIdempotentRequest(transaction, payment, status)) {
        transactionLog.warn(
          'DEPOSIT_WEBHOOK_IDEMPOTENT',
          {
            webhook: { reference: payload.data.reference, incomingStatus: status },
            transaction: { status: transaction.status },
            payment: { status: payment.status },
          },
          'Idempotent webhook call — skipping processing'
        )
        await trx.rollback()
        return this.createSuccessResponse()
      }

      await this.processWebhook(transaction, payment, wallet, payload, status, trx)
      await trx.commit()
      transactionLog.info(
        'DEPOSIT_WEBHOOK_SUCCESS',
        { webhook: { reference: payload.data.reference, status } },
        'Webhook processed successfully'
      )
      return this.createSuccessResponse()
    } catch (error) {
      await trx.rollback()
      transactionLog.error(
        'DEPOSIT_WEBHOOK_ERROR',
        {
          webhook: { reference: payload.data.reference },
          error: {
            status: (error as any).status || 500,
            message: (error as any).message || 'Webhook processing error',
            data: (error as any).data || {},
          },
        },
        (error as any).message || 'Webhook processing error'
      )

      throw error
    }
  }

  /**
   * Validates the payload of the deposit webhook to ensure it contains the required reference.
   *
   * @param {WebhookRequestDto} payload - The payload object of the deposit webhook that needs to be validated.
   * @return {void} Throws an exception if the payload lacks the required reference.
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
   * Loads required entities including transaction, payment, and wallet based on the provided reference.
   *
   * @param {string} reference - The unique reference identifier to find the transaction.
   * @return {Promise<{transaction: Object, payment: Object, wallet: Object}>} A promise that resolves to an object containing the transaction, payment, and wallet entities.
   * @throws {Exception} Throws an exception if the transaction, payment, or wallet is not found.
   */
  private async loadRequiredEntities(
    reference: string
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await this.transactionService.findByReference(reference)

    const [payments, wallet] = await Promise.all([
      this.paymentService.findByTransaction(transaction.transactionsUid || transaction.id),
      this.walletRepository.findByUserId(transaction.usersUid),
    ])

    if (payments.length === 0) {
      throw new Exception('Paiement introuvable pour cette transaction', {
        status: 404,
        code: 'PAYMENT_NOT_FOUND',
      })
    }

    const payment = payments[0]

    if (!wallet) {
      throw new Exception("Wallet de l'utilisateur introuvable", {
        status: 404,
        code: 'WALLET_NOT_FOUND',
      })
    }

    return { transaction, payment, wallet }
  }

  /**
   * Determines whether a given request is idempotent based on the transaction, payment, and incoming status.
   *
   * @param {Transaction} transaction - The current transaction whose status is evaluated.
   * @param {Payment} payment - The associated payment for the transaction.
   * @param {TransactionStatus} incomingStatus - The incoming status of the transaction, typically from an external source.
   * @return {boolean} Returns true if the request is idempotent, false otherwise.
   */
  private isIdempotentRequest(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    const isIncomingSuccess = incomingStatus === TransactionStatus.SUCCESS
    const isCurrentSuccess =
      transaction.status === TransactionStatus.SUCCESS || payment.status === PaymentStatus.SUCCESS
    const isCurrentFailed =
      transaction.status === TransactionStatus.FAILED || payment.status === PaymentStatus.FAILED

    return (isIncomingSuccess && isCurrentSuccess) || (!isIncomingSuccess && isCurrentFailed)
  }

  /**
   * Processes a webhook for handling deposit transactions based on the provided status.
   *
   * @param {Transaction} transaction - The transaction associated with the webhook.
   * @param {Payment} payment - The payment details for the transaction.
   * @param {Wallet} wallet - The wallet related to the transaction.
   * @param {WebhookRequestDto} payload - The payload received from the webhook.
   * @param {string} status - The status of the webhook (e.g., 'success' or 'failed').
   * @param {TransactionClientContract} trx - The database transaction client to ensure atomic operations.
   * @return {Promise<void>} Resolves when the webhook processing is complete.
   */
  private async processWebhook(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    payload: WebhookRequestDto,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    const operatorResponse = { operator_response: payload as any }

    transactionLog.debug(
      'DEPOSIT_WEBHOOK_BODY_PROCESSING',
      {
        webhook: { reference: payload.data.reference, status },
        transaction: { id: transaction.id },
        payment: { id: payment.id },
        wallet: { id: wallet.id },
      },
      'Processing webhook body'
    )

    if (status === TransactionStatus.SUCCESS) {
      transactionLog.info(
        'DEPOSIT_SUCCESS_PROCESSING',
        { webhook: { reference: payload.data.reference } },
        'Processing successful deposit'
      )
      await this.processSuccessfulDeposit(transaction, payment, wallet, operatorResponse, trx)
    }

    if (status === TransactionStatus.FAILED) {
      transactionLog.info(
        'DEPOSIT_FAILED_PROCESSING',
        { webhook: { reference: payload.data.reference } },
        'Processing failed deposit'
      )
      await this.processFailedDeposit(transaction, payment, operatorResponse, trx)
    }
  }

  /**
   * Processes a successful deposit by updating the payment status,
   * adjusting the wallet balance, and marking the transaction as a success.
   *
   * @param {any} transaction - The transaction details related to the deposit.
   * @param {any} payment - The payment information associated with the deposit.
   * @param {any} wallet - The wallet object that needs updating after the deposit.
   * @param {any} operatorResponse - The response from the operator confirming the payment.
   * @param {TransactionClientContract} trx - The database transaction instance to handle atomic operations.
   * @return {Promise<void>} A Promise that resolves when the deposit processing is completed successfully.
   */
  private async processSuccessfulDeposit(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    transactionLog.debug(
      'DEPOSIT_PAYMENT_MARKING_SUCCESS',
      { payment: { id: payment.id } },
      'Marking payment as success'
    )
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)

    transactionLog.debug(
      'DEPOSIT_WALLET_ADJUSTING',
      { wallet: { id: wallet.id } },
      'Adjusting wallet balance for successful deposit'
    )
    const updatedWallet = await this.walletRepository.adjustBalance(
      wallet.id,
      Number(transaction.totalAmount || 0),
      trx
    )

    if (!updatedWallet || !updatedWallet.balance || !updatedWallet.id) {
      transactionLog.error(
        'DEPOSIT_WALLET_UPDATE_FAILED',
        { wallet: { id: wallet.id } },
        'Failed to update wallet during successful deposit'
      )
      throw new Exception('Echec de mise à jour du wallet', {
        status: 500,
        code: 'WALLET_UPDATE_FAILED',
      })
    }

    transactionLog.debug(
      'DEPOSIT_TRANSACTION_MARKING_SUCCESS',
      { transaction: { id: transaction.id } },
      'Marking transaction as success'
    )
    await this.safeMarkTransactionSuccess(transaction.id, updatedWallet.balance!, trx)

    await this.ledgerService.recordDeposit(
      transaction,
      wallet.id,
      wallet.balance,
      updatedWallet.balance,
      trx
    )

    await DepositTransactionCompleted.dispatch({
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: updatedWallet.balance || 0,
    })
  }

  /**
   * Handles the processing of a failed deposit by marking the associated transaction and payment as failed.
   * This function performs both operations in parallel as they are independent of each other.
   *
   * @param {any} transaction - The transaction object related to the failed deposit.
   * @param {any} payment - The payment object associated with the failed transaction.
   * @param {any} operatorResponse - The response or error details from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client contract used for database operations.
   * @return {Promise<void>} - A promise that resolves when the failed deposit process is completed.
   */
  private async processFailedDeposit(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    transactionLog.debug(
      'DEPOSIT_MARKING_FAILED',
      { transaction: { id: transaction.id }, payment: { id: payment.id } },
      'Marking payment and transaction as failed'
    )
    // Process both in parallel since they're independent
    await Promise.all([
      this.safeMarkTransactionFailed(transaction.id, trx),
      this.safeMarkPaymentFailed(payment.id, operatorResponse, trx),
    ])

    await DepositTransactionFailed.dispatch(<DepositTransactionFailedPayload>{
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
    })
  }

  /**
   * Safely marks a payment as successful by interacting with the payment service.
   * If the payment is already marked as successful, it logs the information and skips further action.
   * Throws an error for any other issues encountered during the process.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as successful.
   * @param {any} operatorResponse - The response data originating from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client instance for executing database operations atomically.
   * @return {Promise<void>} A promise that resolves when the payment is successfully marked as such or skips if already marked.
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
      transactionLog.info(
        'DEPOSIT_PAYMENT_ALREADY_SUCCESS',
        { payment: { id: paymentId } },
        'Payment already successful, skipping'
      )
    }
  }

  /**
   * Marks the specified transaction as successful while handling any errors that might occur.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction.
   * @param {TransactionClientContract} trx - The transaction client instance used for the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
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
      transactionLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_SUCCESS',
        { transaction: { id: transactionId } },
        'Transaction already successful, skipping'
      )
    }
  }

  /**
   * Marks a transaction as failed in a safe manner by handling specific errors related to the transaction already being marked as failed.
   *
   * @param {any} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The database transaction client used for performing the operation.
   * @return {Promise<void>} A promise that resolves when the transaction has been safely marked as failed.
   */
  private async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') throw error
      transactionLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transactionId } },
        'Transaction already failed, skipping'
      )
    }
  }

  /**
   * Safely marks a payment as failed by invoking the payment service, with error handling to avoid processing already-failed payments.
   *
   * @param {any} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response or data from the payment operator detailing the failure reason.
   * @param {TransactionClientContract} trx - The database transaction object used to ensure atomicity during the operation.
   * @return {Promise<void>} A promise that resolves when the operation is completed successfully or skips processing if already failed.
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
      transactionLog.info(
        'DEPOSIT_PAYMENT_ALREADY_FAILED',
        { payment: { id: paymentId } },
        'Payment already failed, skipping'
      )
    }
  }

  /**
   * Creates a success response object indicating that the webhook request was received successfully.
   *
   * @return {WebhookResponseDto} An object containing the status code and a success message.
   */
  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
