import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import RefundService from '#features/transactions/application/services/refund_service'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import type { WebhookEventName } from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import type { ClassifiedError } from '#shared/infrastructure/services/error_classifier'
import { ErrorSeverity, ErrorCategory, AdminAction } from '#shared/enums/provider_error_enums'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import TransactionAlreadyFailedException from '#features/transactions/infrastructure/exceptions/transaction_already_failed_exception'
import TransactionAlreadyRefundedException from '#features/transactions/infrastructure/exceptions/transaction_already_refunded_exception'
import PaymentAlreadyFailedException from '#features/transactions/infrastructure/exceptions/payment_already_failed_exception'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface TransactionFailureOptions {
  transactionId: number
  transactionReference: string
  logCode: string
  walletId?: number
  notification?: {
    webhookEvent: WebhookEventName
    webhookData: Record<string, any>
  }
  payment?: {
    paymentId: number
    providerErrorCode?: string
    classifiedError?: ClassifiedError
    operatorResponse?: any
  }
}

@inject()
export default class TransactionFailureHandler {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService
  ) {}

  async handle(options: TransactionFailureOptions): Promise<void> {
    const { transactionId, transactionReference, logCode } = options
    const trx = await db.transaction()

    try {
      const usersUid = await this.resolveFailure(options, trx)
      await this.markPaymentFailed(options, trx)
      await trx.commit()

      await this.dispatchNotification(options, usersUid)

      paymentLog.info(
        `${logCode}_MARKED_FAILED`,
        { reference: transactionReference, transactionId },
        'Transaction failure handled and event dispatched'
      )
    } catch (error) {
      await this.safeRollback(trx)

      if (this.isAlreadyHandled(error)) {
        paymentLog.info(
          `${logCode}_ALREADY_FAILED_SKIPPED`,
          { reference: transactionReference, transactionId },
          'Transaction or payment already failed, skipping handling'
        )
        return
      }

      errorLog.error(
        `${logCode}_MARK_FAILED_CRITICAL`,
        {
          reference: transactionReference,
          transactionId,
          error: this.extractMessage(error),
        },
        'CRITICAL: Failed to handle transaction failure - manual intervention required'
      )

      this.sendAdminAlert(options, error)
      throw error
    }
  }

  // ──────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────

  /**
   * Either auto-reverses a debited wallet or simply marks the transaction FAILED.
   * Returns the `usersUid` for downstream notification.
   */
  private async resolveFailure(
    options: TransactionFailureOptions,
    trx: TransactionClientContract
  ): Promise<string | null> {
    const { transactionId, transactionReference, logCode, walletId } = options

    if (walletId === undefined) {
      const transaction = await this.transactionService.markFailed(transactionId, trx)
      return transaction.usersUid
    }

    try {
      const refund = await this.refundService.autoReversal(transactionId, walletId, trx)
      paymentLog.info(
        `${logCode}_AUTO_REVERSAL_DONE`,
        { reference: transactionReference, transactionId, refundUid: refund.refundUid },
        'Auto-reversal executed successfully'
      )
    } catch (err) {
      if (!(err instanceof TransactionAlreadyRefundedException)) throw err

      paymentLog.info(
        `${logCode}_ALREADY_REFUNDED_SKIPPED`,
        { reference: transactionReference, transactionId },
        'Transaction already refunded, skipping auto-reversal'
      )
    }

    // Single getById call regardless of reversal outcome
    const tx = await this.transactionService.getById(transactionId, trx)
    return tx.usersUid
  }

  private async markPaymentFailed(
    options: TransactionFailureOptions,
    trx: TransactionClientContract
  ): Promise<void> {
    if (!options.payment) return

    const { paymentId, providerErrorCode, classifiedError, operatorResponse } = options.payment

    const definition = providerErrorCode
      ? ProviderErrorService.resolve(providerErrorCode)
      : classifiedError
        ? this.classifiedErrorToDefinition(classifiedError)
        : undefined

    await this.paymentService.markFailed(paymentId, { definition, operatorResponse }, trx)
  }

  private async dispatchNotification(
    options: TransactionFailureOptions,
    usersUid: string | null
  ): Promise<void> {
    if (!options.notification) return

    await DispatchWebhookEventJob.dispatch({
      eventName: options.notification.webhookEvent,
      eventData: {
        ...options.notification.webhookData,
        userId: usersUid,
      },
      reference: options.transactionReference,
    })
  }

  private classifiedErrorToDefinition(classified: ClassifiedError) {
    return {
      code: 'HTTP_ERROR' as any,
      category: classified.category,
      isFinal: !classified.retryable,
      adminAction: classified.adminAction,
      userMessage:
        'Une erreur technique est survenue. Veuillez réessayer plus tard ou contacter le support.',
      adminMessage: classified.adminMessage,
    }
  }

  private isAlreadyHandled(error: unknown): boolean {
    return (
      error instanceof TransactionAlreadyFailedException ||
      error instanceof PaymentAlreadyFailedException
    )
  }

  private async safeRollback(trx: TransactionClientContract): Promise<void> {
    if (trx.isCompleted) return

    try {
      await trx.rollback()
    } catch (rollbackErr) {
      errorLog.error(
        'TRX_ROLLBACK_FAILED',
        { error: this.extractMessage(rollbackErr) },
        'Failed to rollback transaction'
      )
    }
  }

  private extractMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error'
  }

  private sendAdminAlert(options: TransactionFailureOptions, error: unknown): void {
    errorLog.error(
      `${options.logCode}_ADMIN_ALERT`,
      {
        reference: options.transactionReference,
        transactionId: options.transactionId,
        error: this.extractMessage(error),
      },
      'ADMIN ALERT: Transaction failure handling failed - manual intervention required'
    )

    emitter
      .emit('alert:provider-error', {
        severity: ErrorSeverity.AMBIGUOUS,
        category: ErrorCategory.INTERNAL,
        adminAction: AdminAction.ESCALATE,
        adminMessage:
          "Echec critique lors du traitement d'une transaction échouée. Intervention manuelle requise.",
        errorCode: 'FAILURE_HANDLER_ERROR',
        transactionReference: options.transactionReference,
        provider: 'internal',
        context: {
          transactionId: options.transactionId,
          logCode: options.logCode,
          error: this.extractMessage(error),
        },
      })
      .catch(() => {})
  }
}
