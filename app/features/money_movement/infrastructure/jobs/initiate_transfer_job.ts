import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import { maskPhone } from '#shared/utils/utiles'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import emitter from '@adonisjs/core/services/emitter'
import ErrorClassifier, {
  type ClassifiedError,
} from '#shared/infrastructure/services/error_classifier'
import ProviderErrorReporter from '#shared/infrastructure/services/provider_error_reporter'

export interface InitiateTransferPayload {
  transactionId: number
  transactionReference: string
  walletId: number
  paymentId: number
  totalAmount: number
  amount: number
  paymentMethod: string
  operator: string
  phone: string
  userId: string
}

export default class InitiateTransferJob extends Job<InitiateTransferPayload> {
  async execute(): Promise<void> {
    const payload = this.payload
    const { transactionReference, operator, phone, paymentMethod, totalAmount } = payload

    paymentLog.info(
      'TRANSFER_JOB_START',
      { reference: transactionReference, provider: operator },
      'Starting external transfer initiation via job'
    )

    const dataSend = {
      channel: paymentMethod,
      amount: totalAmount,
      provider: operator,
      number: phone,
      country: 'ci',
      currency: 'XOF',
      reference: transactionReference,
      notify_success_url: env.get('NOTIFY_SUCCESS_URL')!,
      notify_failure_url: env.get('NOTIFY_FAILURE_URL')!,
    }

    try {
      const httpClient = await app.container.make(HttpClient)
      const result = await httpClient.post(env.get('API_TRANSFERT_URL')!, dataSend)

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
          'TRANSFER_EXTERNAL_FAILED',
          { reference: transactionReference, error: result.error },
          'External transfer API call failed'
        )

        await this.handleFailure(payload, classified)
        return
      }

      paymentLog.info(
        'TRANSFER_EXTERNAL_INITIATED',
        {
          reference: transactionReference,
          provider: operator,
          numberMasked: maskPhone(phone),
        },
        'External transfer initiated via job'
      )
    } catch (err) {
      const classified = ErrorClassifier.classify({
        message: err instanceof Error ? err.message : 'Unknown error',
        networkCode: (err as any)?.code,
      })

      ProviderErrorReporter.reportNetworkException(classified, err, this.buildReporterContext())

      errorLog.error(
        'TRANSFER_EXTERNAL_INIT_ERROR',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate external transfer'
      )

      await this.handleFailure(payload, classified)
    }
  }

  private buildReporterContext() {
    return {
      logPrefix: 'TRANSFER',
      transactionReference: this.payload.transactionReference,
      provider: this.payload.operator,
      paymentMethod: this.payload.paymentMethod,
      operationType: 'transfer',
    }
  }

  private async handleFailure(
    payload: InitiateTransferPayload,
    classified?: ClassifiedError
  ): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      logCode: 'TRANSFER',
      walletId: payload.walletId,
      notification: {
        webhookEvent: 'TransfertTransactionFailed',
        webhookData: {
          reference: payload.transactionReference,
          amount: payload.totalAmount,
          beneficiaryPhone: payload.phone,
        },
      },
      payment: {
        paymentId: payload.paymentId,
        classifiedError: classified,
      },
    })
  }
}
