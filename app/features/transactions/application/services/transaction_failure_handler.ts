import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import queue from '@rlanz/bull-queue/services/main'
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

      await queue.dispatch(DispatchWebhookEventJob, {
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

      this.sendAdminAlert(options, markErr)
      throw markErr
    }
  }

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
