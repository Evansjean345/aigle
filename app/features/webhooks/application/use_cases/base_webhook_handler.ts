import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#features/transactions/infrastructure/exceptions/payment_not_found_exception'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import errorLog from '#shared/infrastructure/logging/error_log'

export const WEBHOOK_SUCCESS_RESPONSE: WebhookResponseDto = {
  status: 200,
  message: 'received',
} as const

export default abstract class BaseWebhookHandler {
  protected abstract readonly paymentService: PaymentService
  protected abstract readonly transactionService: TransactionService

  /**
   * Validates the payload received in a webhook request.
   * Ensures that the payload contains the required fields `reference` and `status`.
   * Logs warnings and throws exceptions if validation fails.
   *
   * @param {WebhookRequestDto} payload - The webhook request payload to validate.
   * @throws {Exception} Throws an exception if the required `reference` or `status` fields are missing in the payload.
   * @return {void}
   */
  protected validatePayload(payload: WebhookRequestDto): void {
    if (!payload?.data?.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        { webhook: payload?.data },
        'Missing reference in webhook'
      )
      throw new Exception('Invalid payload: Missing reference', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }

    if (!payload?.data?.status) {
      paymentLog.warn(
        'WEBHOOK_STATUS_REQUIRED',
        { webhook: payload?.data },
        'Missing status in webhook'
      )
      throw new Exception('Invalid payload: Missing status', {
        status: 422,
        code: 'WEBHOOK_STATUS_REQUIRED',
      })
    }
  }

  /**
   * Loads a transaction by its reference and ensures it is locked for update.
   *
   * @param {string} reference - The unique reference identifier of the transaction to be retrieved.
   * @param {TransactionClientContract} trx - The current transaction client used for querying the database.
   * @return {Promise<Transaction>} A promise that resolves to the transaction object if found.
   * @throws {TransactionNotFoundException} If the transaction with the given reference is not found.
   */
  protected async loadTransaction(
    reference: string,
    trx: TransactionClientContract
  ): Promise<Transaction> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable')
    }

    return transaction
  }

  /**
   * Loads a transaction along with its associated payments.
   *
   * @param {string} reference - The reference identifier for the transaction to be loaded.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<{ transaction: Transaction, payments: Payment[] }>} A promise that resolves to an object containing the transaction and its associated payments.
   * @throws {PaymentNotFoundException} If no payments are found for the specified transaction.
   */
  protected async loadTransactionWithPayments(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payments: Payment[] }> {
    const transaction = await this.loadTransaction(reference, trx)
    const payments = await this.paymentService.findByTransaction(
      transaction.transactionsUid || transaction.id
    )

    if (payments.length === 0) {
      throw new PaymentNotFoundException('Paiement introuvable pour cette transaction')
    }

    return { transaction, payments }
  }

  /**
   * Loads a transaction along with the associated payment and wallet details.
   *
   * @param {string} reference - The unique reference identifier for the transaction.
   * @param {WalletService} walletService - The wallet service instance used to retrieve wallet details.
   * @param {TransactionClientContract} trx - The transaction client instance used for database operations.
   * @param {0 | 1} [paymentOrder=0] - The index of the payment to load from the list of associated payments.
   * @return {Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }>}
   * A promise that resolves to an object containing the transaction, selected payment, and associated wallet.
   */
  protected async loadTransactionWithWallet(
    reference: string,
    walletService: WalletService,
    trx: TransactionClientContract,
    paymentOrder: 0 | 1 = 0
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const { transaction, payments } = await this.loadTransactionWithPayments(reference, trx)

    try {
      const wallet = await walletService.getByUserId(transaction.usersUid)
      return { transaction, payment: payments[paymentOrder], wallet }
    } catch (error) {
      if (error instanceof WalletNotFoundException) {
        errorLog.error(
          'WEBHOOK_WALLET_NOT_FOUND',
          {
            transaction_id: transaction.id,
            user_uid: transaction.usersUid,
            reference: transaction.reference,
          },
          'Critical: Wallet not found for user associated with transaction'
        )
      }
      throw error
    }
  }

  /**
   * Determines whether a given transaction and payment combination is idempotent
   * based on their current statuses and an incoming transaction status.
   *
   * @param {Transaction} transaction - The transaction object containing its current status.
   * @param {Payment} payment - The payment object containing its current status.
   * @param {TransactionStatus} incomingStatus - The incoming status to evaluate for idempotency.
   * @return {boolean} Returns true if the transaction and payment statuses match the criteria
   *                   for idempotency, false otherwise.
   */
  protected isIdempotent(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    if (incomingStatus === TransactionStatus.SUCCESS) {
      return (
        transaction.status === TransactionStatus.SUCCESS && payment.status === PaymentStatus.SUCCESS
      )
    }

    return (
      transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
    )
  }

  /**
   * Executes a callback function within a database transaction.
   * Commits the transaction if the callback function resolves successfully,
   * otherwise rolls back the transaction if an error occurs.
   *
   * @param {function} handler - A callback function that performs operations within the transaction.
   *                             The function receives the transaction client as its argument.
   * @return {Promise<T>} A promise that resolves with the returned value of the callback function
   *                       if the transaction commits successfully, or rejects with an error
   *                       if the transaction is rolled back.
   */
  protected async withTransaction<T>(
    handler: (trx: TransactionClientContract) => Promise<T>
  ): Promise<T> {
    const trx = await db.transaction()
    try {
      const result = await handler(trx)
      await trx.commit()
      return result
    } catch (error) {
      if (!trx.isCompleted) {
        await trx.rollback()
      }

      throw error
    }
  }

  /**
   * Safely marks a payment transaction as successful. If the payment has already been marked as successful,
   * it logs an informational message and skips re-processing.
   *
   * @param {number} paymentId - The unique identifier for the payment to be marked as successful.
   * @param {any} operatorResponse - The response data from the payment operator to be recorded.
   * @param {TransactionClientContract} trx - The transaction object used to ensure database consistency.
   * @return {Promise<void>} A promise that resolves when the operation is completed, or rejects if an unexpected error occurs.
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
      paymentLog.info(
        'PAYMENT_ALREADY_SUCCESS',
        { payment: { id: paymentId } },
        'Payment already successful, skipping'
      )
    }
  }

  /**
   * Safely marks a payment as failed. If the payment is already marked as failed, the method handles the condition gracefully
   * by logging the information and skipping the operation.
   *
   * @param {number} paymentId - The unique identifier of the payment to mark as failed.
   * @param {any} operatorResponse - The response object from the operator providing details of the failure.
   * @param {TransactionClientContract} trx - The database transaction client to be used for the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
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
      paymentLog.info(
        'PAYMENT_ALREADY_FAILED',
        { payment: { id: paymentId } },
        'Payment already failed, skipping'
      )
    }
  }

  /**
   * Marks a transaction as successful in a safe manner, ensuring idempotency.
   * If the transaction has already been marked as successful, an informational log is recorded and no further action is taken.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction to be updated.
   * @param {TransactionClientContract} trx - The database transaction client used for the operation.
   * @return {Promise<void>} A promise that resolves when the operation completes or rejects if an unexpected error occurs.
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
      transactionLog.info(
        'TRANSACTION_ALREADY_SUCCESS',
        { transaction: { id: transactionId } },
        'Transaction already successful, skipping'
      )
    }
  }

  /**
   * Safely marks a transaction as failed in the database.
   * Prevents rethrowing an error if the transaction is already marked as failed.
   *
   * @param {number} transactionId - The unique identifier of the transaction to mark as failed.
   * @param {TransactionClientContract} trx - The database transaction client used to perform the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  protected async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') throw error
      transactionLog.info(
        'TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transactionId } },
        'Transaction already failed, skipping'
      )
    }
  }

  /**
   * Dispatches an event by calling its `dispatch` method with the given payload.
   * Logs an error if the event dispatch fails.
   *
   * @param {Object} event - The event object containing the `dispatch` method.
   * @param {Function} event.dispatch - A function that accepts a payload and returns a Promise.
   * @param {any} payload - The data to be passed to the event's `dispatch` method.
   * @param {string} eventCode - A unique code representing the event.
   * @param {string} reference - A reference identifier for logging or error tracking purposes.
   * @return {void}
   */
  protected dispatchEvent(
    event: { dispatch: (payload: any) => Promise<any> },
    payload: any,
    eventCode: string,
    reference: string
  ): void {
    event.dispatch(payload).catch((err: unknown) => {
      errorLog.error(
        `${eventCode}_DISPATCH_FAILED`,
        {
          reference,
          error: err instanceof Error ? err.message : 'Unknown',
        },
        `Non-critical: Failed to dispatch ${eventCode} event`
      )
    })
  }

  /**
   * Builds and returns a response object containing the operator's response.
   *
   * @param {WebhookRequestDto} payload - The incoming webhook request payload containing the necessary data.
   * @return {{ operator_response: any }} An object containing the operator response extracted from the payload.
   */
  protected buildOperatorResponse(payload: WebhookRequestDto): { operator_response: any } {
    return { operator_response: payload.data }
  }
}
