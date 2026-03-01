import { Job } from '@rlanz/bull-queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import HttpClient from '#shared/infrastructure/http_client_service'
import { maskPhone } from '#shared/utils/utiles'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'

export interface InitiateTransferPayload {
  transactionId: number
  transactionReference: string
  walletId: number
  totalAmount: number
  amount: number
  paymentMethod: string
  operator: string
  phone: string
  userId: string
}

export default class InitiateTransferJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  async handle(payload: InitiateTransferPayload): Promise<void> {
    const { transactionReference, operator, phone, paymentMethod, totalAmount } = payload

    paymentLog.info(
      'TRANSFER_JOB_START',
      { reference: transactionReference, provider: operator },
      'Starting external transfer initiation via job'
    )

    const dataSend = {
      operation_type: paymentMethod,
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

      if (!result.success) {
        paymentLog.error(
          'TRANSFER_EXTERNAL_FAILED',
          { reference: transactionReference, error: result.error },
          'External transfer API call failed'
        )
        await this.handleFailure(payload)
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
      errorLog.error(
        'TRANSFER_EXTERNAL_INIT_ERROR',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate external transfer'
      )

      await this.handleFailure(payload)
    }
  }

  private async handleFailure(payload: InitiateTransferPayload): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      webhookEvent: 'TransfertTransactionFailed',
      webhookData: {
        reference: payload.transactionReference,
        amount: payload.totalAmount,
        beneficiaryPhone: payload.phone,
      },
      compensation: {
        walletId: payload.walletId,
        amount: payload.amount,
      },
      logCode: 'TRANSFER',
    })
  }

  async rescue(payload: InitiateTransferPayload, error: Error): Promise<void> {
    errorLog.error(
      'TRANSFER_JOB_EXHAUSTED',
      {
        reference: payload.transactionReference,
        transactionId: payload.transactionId,
        error: error.message,
      },
      'Transfer job failed after all retries'
    )

    await this.handleFailure(payload)
  }
}
