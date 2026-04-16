import env from '#start/env'
import app from '@adonisjs/core/services/app'
import BaseAggregatorJob, {
  type BaseAggregatorPayload,
} from '#features/operations/application/jobs/base_aggregator_job'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import { type ClassifiedError } from '#shared/infrastructure/services/error_classifier'

export interface InitiateDepositPayload extends BaseAggregatorPayload {
  totalAmount: number
  paymentMethod: string
  paymentId: number
  pinCode?: string
}

export default class InitiateDepositJob extends BaseAggregatorJob<InitiateDepositPayload> {
  protected readonly jobName = 'deposit checkout'
  protected readonly logPrefix = 'DEPOSIT_CHECKOUT'

  protected getApiUrl(): string {
    return env.get('API_CHECKOUT_URL')!
  }

  protected buildRequestData(payload: InitiateDepositPayload): Record<string, any> {
    const data: Record<string, any> = {
      operation_type: payload.paymentMethod,
      amount: payload.amount,
      provider: payload.operator,
      number: payload.phone,
      country: 'ci',
      currency: 'XOF',
      reference: payload.transactionReference,
      notify_success_url: env.get('NOTIFY_DEPOSIT_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_DEPOSIT_FAILURE_URL'),
    }

    if (payload.operator === 'orange' && payload.pinCode) {
      data.otp = payload.pinCode
    }

    return data
  }

  protected async onClassifiedError(
    payload: InitiateDepositPayload,
    classified: ClassifiedError,
    _error: any
  ): Promise<void> {
    await this.handleFailure(payload, classified)
  }

  protected async onUnexpectedError(
    payload: InitiateDepositPayload,
    _error: unknown
  ): Promise<void> {
    await this.handleFailure(payload)
  }

  private async handleFailure(
    payload: InitiateDepositPayload,
    classified?: ClassifiedError
  ): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      logCode: 'DEPOSIT_CHECKOUT',
      notification: {
        webhookEvent: 'DepositTransactionFailed',
        webhookData: {
          reference: payload.transactionReference,
          amount: payload.amount,
        },
      },
      payment: {
        paymentId: payload.paymentId,
        classifiedError: classified,
      },
    })
  }
}
