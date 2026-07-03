import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import config from '@adonisjs/core/services/config'
import emitter from '@adonisjs/core/services/emitter'
import ErrorClassifier, {
  type ClassifiedError,
} from '#shared/infrastructure/services/error_classifier'
import ProviderErrorReporter from '#shared/infrastructure/services/provider_error_reporter'

export interface InitiateInterTransferPayload {
  transactionId: number
  transactionReference: string
  paymentId: number
  amount: number
  totalAmount: number
  paymentMethod: string
  operator: string
  phone: string
  userId: string
  pinCode?: string
}

export default class InitiateInterTransferJob extends Job<InitiateInterTransferPayload> {
  async execute(): Promise<void> {
    const payload = this.payload
    const { transactionReference, operator, phone, paymentMethod, amount } = payload

    paymentLog.info(
      'INTER_TRANSFER_JOB_START',
      { reference: transactionReference, provider: operator },
      'Starting inter-transfer checkout initiation via job'
    )

    const dataSend: Record<string, any> = {
      channel: paymentMethod,
      amount: amount,
      provider: operator,
      number: phone,
      country: 'ci',
      currency: 'XOF',
      reference: transactionReference,
      notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL'),
    }

    // Wave/Orange specific: redirect URLs
    if (['wave', 'orange'].includes(payload.operator)) {
      const deepLink = (() => {
        const url = new URL(config.get('app.mobileDeviceDeepLink') as string)
        url.searchParams.set('reference', transactionReference)
        url.searchParams.set('provider', operator)
        return url.toString()
      })()

      dataSend.success_url = deepLink
      dataSend.error_url = deepLink
    }

    try {
      const httpClient = await app.container.make(HttpClient)
      const result = await httpClient.post(env.get('API_CHECKOUT_URL')!, dataSend)

      emitter
        .emit('activity:transaction-log', {
          event: 'SENT_TO_AGGREGATOR',
          transactionId: payload.transactionReference,
          provider: operator,
          reference: transactionReference,
        })
        .catch((_) => {})

      emitter
        .emit('activity:transaction-log', {
          event: 'AGGREGATOR_RESPONSE_RECEIVED',
          transactionId: payload.transactionReference,
          provider: operator,
          success: result.success,
          errorMessage: result.success ? undefined : result.error?.message,
        })
        .catch((_) => {})

      if (!result.success) {
        const classified = ErrorClassifier.classify({
          httpStatus: result.error?.statusCode,
          message: result.error?.message,
          networkCode: result.error?.code,
        })

        ProviderErrorReporter.report(classified, result.error ?? {}, this.buildReporterContext())

        paymentLog.error(
          'INTER_TRANSFER_CHECKOUT_FAILED',
          { reference: transactionReference, error: result.error },
          'Checkout API call failed for inter-transfer'
        )

        await this.handleFailure(payload, classified)
        return
      }

      paymentLog.info(
        'INTER_TRANSFER_CHECKOUT_INITIATED',
        {
          reference: transactionReference,
          provider: operator,
        },
        'Inter-transfer checkout initiated via job'
      )
    } catch (err) {
      const classified = ErrorClassifier.classify({
        message: err instanceof Error ? err.message : 'Unknown error',
        networkCode: (err as any)?.code,
      })

      ProviderErrorReporter.reportNetworkException(classified, err, this.buildReporterContext())

      errorLog.error(
        'INTER_TRANSFER_CHECKOUT_INIT_ERROR',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate inter-transfer checkout'
      )

      await this.handleFailure(payload, classified)
    }
  }

  private buildReporterContext() {
    return {
      logPrefix: 'INTER_TRANSFER',
      transactionReference: this.payload.transactionReference,
      provider: this.payload.operator,
      paymentMethod: this.payload.paymentMethod,
      operationType: 'inter_transfer',
    }
  }

  private async handleFailure(
    payload: InitiateInterTransferPayload,
    classified?: ClassifiedError
  ): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      logCode: 'INTER_TRANSFER',
      notification: {
        webhookEvent: 'TransfertInterTransactionFailed',
        webhookData: {
          reference: payload.transactionReference,
          amount: payload.totalAmount,
        },
      },
      payment: {
        paymentId: payload.paymentId,
        classifiedError: classified,
      },
    })
  }
}
