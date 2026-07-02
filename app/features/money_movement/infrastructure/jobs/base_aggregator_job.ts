import { Job } from '@adonisjs/queue'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import emitter from '@adonisjs/core/services/emitter'
import ErrorClassifier, {
  type ClassifiedError,
} from '#shared/infrastructure/services/error_classifier'
import ProviderErrorReporter from '#shared/infrastructure/services/provider_error_reporter'

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

        ProviderErrorReporter.report(classified, result.error ?? {}, this.buildReporterContext())
        await this.onClassifiedError(this.payload, classified, result.error)
        return
      }

      paymentLog.info(
        `${this.logPrefix}_INITIATED`,
        { reference: transactionReference, provider: operator },
        `${this.jobName} initiated via job`
      )
    } catch (err) {
      const classified = ErrorClassifier.classify({
        message: err instanceof Error ? err.message : 'Unknown error',
        networkCode: (err as any)?.code,
      })

      ProviderErrorReporter.reportNetworkException(classified, err, this.buildReporterContext())
      await this.onUnexpectedError(this.payload, err)
    }
  }

  private buildReporterContext() {
    return {
      logPrefix: this.logPrefix,
      transactionReference: this.payload.transactionReference,
      provider: this.payload.operator,
      paymentMethod: this.payload.paymentMethod,
      operationType: this.jobName,
    }
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
}
