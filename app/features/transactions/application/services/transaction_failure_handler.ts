import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import WalletService from '#features/wallet/application/services/wallet_service'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import type { WebhookEventName } from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

export interface TransactionFailureOptions {
  transactionId: number
  transactionReference: string
  webhookEvent: WebhookEventName
  webhookData: Record<string, any>
  compensation?: {
    walletId: number
    amount: number
  }
  paymentId?: number
  logCode: string
}

@inject()
export default class TransactionFailureHandler {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService
  ) {}

  /**
   * Handles a failed transaction by updating relevant records, triggering compensations if applicable,
   * and dispatching events to notify the concerned parties. Rolls back changes in case of an error
   * and logs the failure for manual intervention if necessary.
   *
   * @param {TransactionFailureOptions} options - The options required to handle the transaction failure.
   * @param {string} options.transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {string} options.transactionReference - The reference identifier associated with the transaction.
   * @param {string} options.logCode - A code used for logging purposes.
   * @param {Object} [options.compensation] - An optional object containing compensation details.
   * @param {string} options.compensation.walletId - The wallet ID to credit as part of compensation.
   * @param {number} options.compensation.amount - The compensation amount to be credited.
   * @param {string} [options.paymentId] - The unique identifier of the payment to be marked as failed.
   * @param {string} options.webhookEvent - The webhook event name to be dispatched.
   * @param {Object} options.webhookData - Additional data to include when dispatching the webhook event.
   *
   * @return {Promise<void>} Resolves once the transaction failure has been successfully handled.
   * @throws Will throw an error if the transaction failure handling encounters an issue.
   */
  async handle(options: TransactionFailureOptions): Promise<void> {
    const { transactionId, transactionReference, logCode } = options

    const trx = await db.transaction()

    try {
      if (options.compensation) {
        await this.walletService.creditBalance(
          options.compensation.walletId,
          options.compensation.amount,
          trx
        )
      }

      const transaction = await this.transactionService.markFailed(transactionId, trx)

      if (options.paymentId) {
        await this.paymentService.markFailed(options.paymentId, {}, trx)
      }

      await trx.commit()

      await DispatchWebhookEventJob.dispatch({
        eventName: options.webhookEvent,
        eventData: {
          ...options.webhookData,
          userId: transaction.usersUid,
        },
        reference: transactionReference,
      })

      paymentLog.info(
        `${logCode}_MARKED_FAILED`,
        { reference: transactionReference, transactionId },
        'Transaction marked as failed and failure event dispatched'
      )
    } catch (markErr) {
      if (!trx.isCompleted) await trx.rollback()

      errorLog.error(
        `${logCode}_MARK_FAILED_CRITICAL`,
        {
          reference: transactionReference,
          transactionId,
          error: markErr instanceof Error ? markErr.message : 'Unknown error',
        },
        'CRITICAL: Failed to handle transaction failure - manual intervention required'
      )

      await this.sendAdminAlert(options, markErr)
      throw markErr
    }
  }

  /**
   * Sends an administrative alert email in case of a transaction failure that requires manual intervention.
   *
   * @param {TransactionFailureOptions} options - Object containing details about the failed transaction, including a log code, reference, and transaction ID.
   * @param {unknown} error - The error encountered during the transaction process. This could be an instance of `Error` or any unknown object.
   * @return {void} No value is returned by this method.
   */
  private sendAdminAlert(options: TransactionFailureOptions, error: unknown): void {
    // TODO: Send admin alert email
    errorLog.error(
      `${options.logCode}_ADMIN_ALERT`,
      {
        reference: options.transactionReference,
        transactionId: options.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'ADMIN ALERT: Transaction failure handling failed - manual intervention required'
    )
  }
}
