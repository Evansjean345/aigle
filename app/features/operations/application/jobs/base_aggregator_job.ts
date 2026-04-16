import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import emitter from '@adonisjs/core/services/emitter'
import ErrorClassifier, {
  type ClassifiedError,
} from '#shared/infrastructure/services/error_classifier'
import { ErrorSeverity, AdminAction } from '#shared/enums/provider_error_enums'

export interface BaseAggregatorPayload {
  transactionId: number
  transactionReference: string
  amount: number
  operator: string
  paymentMethod: string
  phone: string
  userId: string
}

export default abstract class BaseAggregatorJob<T extends BaseAggregatorPayload> extends Job<T> {
  protected abstract readonly jobName: string
  protected abstract readonly logPrefix: string

  protected abstract buildRequestData(payload: T): Record<string, any>
  protected abstract getApiUrl(): string

  /**
   * Handles a classified error with the specified payload, severity, and error details.
   * Subclasses should override to mark transactions as failed via TransactionFailureHandler.
   */
  protected async onClassifiedError(
    _payload: T,
    _classified: ClassifiedError,
    _error: any
  ): Promise<void> {}

  /**
   * Handles unexpected errors that occur during the operation of the system.
   * Subclasses should override to mark transactions as failed via TransactionFailureHandler.
   */
  protected async onUnexpectedError(_payload: T, _error: unknown): Promise<void> {}

  async execute(): Promise<void> {
    const { transactionReference, operator } = this.payload

    paymentLog.info(
      `${this.logPrefix}_JOB_START`,
      { reference: transactionReference, provider: operator },
      `Starting ${this.jobName} initiation via job`
    )

    const dataSend = this.buildRequestData(this.payload)

    try {
      const httpClient = await app.container.make(HttpClient)
      const result = await httpClient.post(this.getApiUrl(), dataSend)

      this.emitTransactionLog('SENT_TO_AGGREGATOR', {
        provider: operator,
        reference: transactionReference,
      })

      this.emitTransactionLog('AGGREGATOR_RESPONSE_RECEIVED', {
        provider: operator,
        success: result.success,
        errorMessage: result.success ? undefined : result.error?.message,
      })

      if (!result.success) {
        const classified = ErrorClassifier.classify({
          httpStatus: result.error?.statusCode,
          message: result.error?.message,
          networkCode: result.error?.code,
        })

        this.logByClassifiedError(classified, result.error)
        this.emitAlertIfNeeded(classified, result.error)
        await this.onClassifiedError(this.payload, classified, result.error)
        return
      }

      paymentLog.info(
        `${this.logPrefix}_INITIATED`,
        { reference: transactionReference, provider: operator },
        `${this.jobName} initiated via job`
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      const classified = ErrorClassifier.classify({
        message: errorMessage,
        networkCode: (err as any)?.code,
      })

      errorLog.error(
        `${this.logPrefix}_INIT_ERROR`,
        { reference: transactionReference, error: errorMessage, severity: classified.severity },
        `Failed to initiate ${this.jobName}`
      )

      this.emitAlertIfNeeded(classified, { message: errorMessage, code: (err as any)?.code })
      await this.onUnexpectedError(this.payload, err)
    }
  }

  private emitAlertIfNeeded(classified: ClassifiedError, error?: any): void {
    if (classified.adminAction === AdminAction.NONE) return

    const { transactionReference, operator, paymentMethod } = this.payload

    emitter
      .emit('alert:provider-error', {
        severity: classified.severity,
        category: classified.category,
        adminAction: classified.adminAction,
        adminMessage: classified.adminMessage,
        errorCode: 'HTTP_ERROR',
        transactionReference,
        provider: operator,
        context: {
          operationType: this.jobName,
          paymentMethod,
          httpStatus: error?.statusCode,
          message: error?.message,
          details: error?.details,
        },
      })
      .catch(() => {})
  }

  private emitTransactionLog(event: string, extra: Record<string, any>): void {
    emitter
      .emit('activity:transaction-log', {
        event,
        transactionId: this.payload.transactionReference,
        ...extra,
      })
      .catch(() => {})
  }

  private logByClassifiedError(classified: ClassifiedError, error: any): void {
    const ref = this.payload.transactionReference

    switch (classified.severity) {
      case ErrorSeverity.CONFIGURATION:
        paymentLog.error(
          `${this.logPrefix}_CONFIG_ERROR`,
          { reference: ref, error, severity: 'CONFIGURATION' },
          'Aggregator rejected due to configuration issue'
        )
        break

      case ErrorSeverity.RETRYABLE:
        paymentLog.warn(
          `${this.logPrefix}_RETRYABLE`,
          { reference: ref, error, severity: 'RETRYABLE' },
          'Checkout failed — retryable, will retry'
        )
        break

      case ErrorSeverity.AMBIGUOUS:
        paymentLog.warn(
          `${this.logPrefix}_AMBIGUOUS`,
          { reference: ref, error, severity: 'AMBIGUOUS' },
          'Checkout failed — ambiguous error, needs investigation'
        )
        break

      case ErrorSeverity.DEFINITIVE:
        paymentLog.error(
          `${this.logPrefix}_DEFINITIVE`,
          { reference: ref, error, severity: 'DEFINITIVE' },
          'Checkout failed — definitive error'
        )
        break
    }
  }
}
