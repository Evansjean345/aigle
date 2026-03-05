import { Job } from '@rlanz/bull-queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/http_client_service'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import config from '@adonisjs/core/services/config'
import emitter from '@adonisjs/core/services/emitter'

export interface InitiateInterTransferPayload {
  transactionId: number
  transactionReference: string
  amount: number
  totalAmount: number
  paymentMethod: string
  operator: string
  phone: string
  userId: string
  pinCode?: string
}

export default class InitiateInterTransferJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  async handle(payload: InitiateInterTransferPayload): Promise<void> {
    const { transactionReference, operator, phone, paymentMethod, amount } = payload

    paymentLog.info(
      'INTER_TRANSFER_JOB_START',
      { reference: transactionReference, provider: operator },
      'Starting inter-transfer checkout initiation via job'
    )

    const dataSend: Record<string, any> = {
      operation_type: paymentMethod,
      amount: amount,
      provider: operator,
      number: phone,
      country: 'ci',
      currency: 'XOF',
      reference: transactionReference,
      notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_FAILURE_URL'),
    }

    // Orange Money specific: OTP
    if (operator === 'orange' && payload.pinCode) {
      dataSend.otp = payload.pinCode
    }

    // Wave specific: redirect URLs
    if (operator === 'wave') {
      dataSend.success_url = config.get('app.mobileDeviceDeepLink')
      dataSend.error_url = config.get('app.mobileDeviceDeepLink')
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

      if (!result.success) {
        paymentLog.error(
          'INTER_TRANSFER_CHECKOUT_FAILED',
          { reference: transactionReference, error: result.error },
          'Checkout API call failed for inter-transfer'
        )
        await this.handleFailure(payload)
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
      errorLog.error(
        'INTER_TRANSFER_CHECKOUT_INIT_ERROR',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate inter-transfer checkout'
      )

      await this.handleFailure(payload)
    }
  }

  private async handleFailure(payload: InitiateInterTransferPayload): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      webhookEvent: 'TransfertInterTransactionFailed',
      webhookData: {
        reference: payload.transactionReference,
        amount: payload.totalAmount,
      },
      logCode: 'INTER_TRANSFER',
    })
  }

  async rescue(payload: InitiateInterTransferPayload, error: Error): Promise<void> {
    errorLog.error(
      'INTER_TRANSFER_JOB_EXHAUSTED',
      {
        reference: payload.transactionReference,
        transactionId: payload.transactionId,
        error: error.message,
      },
      'Inter-transfer job failed after all retries'
    )

    await this.handleFailure(payload)
  }
}
