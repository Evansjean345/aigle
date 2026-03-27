import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/http_client_service'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import emitter from '@adonisjs/core/services/emitter'

export interface InitiateDepositPayload {
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

export default class InitiateDepositJob extends Job<InitiateDepositPayload> {
  async execute(): Promise<void> {
    const payload = this.payload
    const { transactionReference, operator, phone, paymentMethod, amount } = payload

    paymentLog.info(
      'DEPOSIT_JOB_START',
      { reference: transactionReference, provider: operator },
      'Starting deposit checkout initiation via job'
    )

    const dataSend: Record<string, any> = {
      operation_type: paymentMethod,
      amount: amount,
      provider: operator,
      number: phone,
      country: 'ci',
      currency: 'XOF',
      reference: transactionReference,
      notify_success_url: env.get('NOTIFY_DEPOSIT_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_DEPOSIT_FAILURE_URL'),
    }

    // Orange Money specific: OTP
    if (operator === 'orange' && payload.pinCode) {
      dataSend.otp = payload.pinCode
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
        paymentLog.error(
          'DEPOSIT_CHECKOUT_FAILED',
          { reference: transactionReference, error: result.error },
          'Checkout API call failed for deposit'
        )
        await this.handleFailure(payload)
        return
      }

      paymentLog.info(
        'DEPOSIT_CHECKOUT_INITIATED',
        {
          reference: transactionReference,
          provider: operator,
        },
        'Deposit checkout initiated via job'
      )
    } catch (err) {
      errorLog.error(
        'DEPOSIT_CHECKOUT_INIT_ERROR',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate deposit checkout'
      )

      await this.handleFailure(payload)
    }
  }

  private async handleFailure(payload: InitiateDepositPayload): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      webhookEvent: 'DepositTransactionFailed',
      webhookData: {
        reference: payload.transactionReference,
        amount: payload.totalAmount,
      },
      logCode: 'DEPOSIT',
    })
  }

  async failed(error: Error): Promise<void> {
    const payload = this.payload

    emitter
      .emit('activity:transaction-log', {
        event: 'RETRY',
        transactionId: payload.transactionReference,
        attempt: this.context.attempt,
      })
      .catch((_) => {})

    errorLog.error(
      'DEPOSIT_JOB_EXHAUSTED',
      {
        reference: payload.transactionReference,
        transactionId: payload.transactionId,
        error: error.message,
      },
      'Deposit job failed after all retries'
    )

    await this.handleFailure(payload)
  }
}
