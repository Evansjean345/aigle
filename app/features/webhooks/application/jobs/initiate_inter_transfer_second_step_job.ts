import { Job } from '@adonisjs/queue'
import env from '#start/env'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { maskPhone } from '#shared/utils/utiles'
import app from '@adonisjs/core/services/app'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import emitter from '@adonisjs/core/services/emitter'

export interface InitiateInterTransferSecondStepPayload {
  transactionId: number
  transactionReference: string
  secondPaymentId: number
  totalAmount: number
  paymentMethod: string
  operator: string
  phone: string
}

export default class InitiateInterTransferSecondStepJob extends Job<InitiateInterTransferSecondStepPayload> {
  async execute(): Promise<void> {
    const payload = this.payload
    const { transactionReference, secondPaymentId, paymentMethod, operator, phone } = payload

    paymentLog.info(
      'INTER_TRANSFER_SECOND_STEP_JOB_START',
      { reference: transactionReference, paymentId: secondPaymentId },
      'Starting second step initiation via job'
    )

    const dataSend = {
      operation_type: paymentMethod,
      amount: payload.totalAmount,
      provider: operator,
      number: phone,
      country: 'ci',
      currency: 'XOF',
      reference: transactionReference,
      notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_SUCCESS_URL'),
      notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_FAILURE_URL'),
    }

    try {
      const httpClient = await app.container.make(HttpClient)
      await httpClient.post(env.get('API_TRANSFERT_URL')!, dataSend)

      emitter
        .emit('activity:transaction-log', {
          event: 'SENT_TO_AGGREGATOR',
          transactionId: payload.transactionReference,
          provider: operator,
          reference: transactionReference,
        })
        .catch((_) => {})

      paymentLog.info(
        'INTER_TRANSFER_SECOND_INITIATED',
        {
          reference: transactionReference,
          paymentId: secondPaymentId,
          provider: operator,
          numberMasked: maskPhone(phone),
        },
        'Second inter-transfer step initiated via job'
      )
    } catch (err) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_INIT_FAILED',
        {
          reference: transactionReference,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to initiate second inter-transfer step'
      )

      await this.handleFailure(payload)
    }
  }

  private async handleFailure(payload: InitiateInterTransferSecondStepPayload): Promise<void> {
    const failureHandler = await app.container.make(TransactionFailureHandler)

    await failureHandler.handle({
      transactionId: payload.transactionId,
      transactionReference: payload.transactionReference,
      logCode: 'INTER_TRANSFER_SECOND_STEP',
      notification: {
        webhookEvent: 'TransfertInterTransactionFailed',
        webhookData: {
          reference: payload.transactionReference,
          amount: payload.totalAmount,
          beneficiaryPhone: payload.phone,
        },
      },
      payment: {
        paymentId: payload.secondPaymentId,
      },
    })
  }

  async failed(error: Error): Promise<void> {
    const payload = this.payload
    errorLog.error(
      'INTER_TRANSFER_SECOND_STEP_JOB_EXHAUSTED',
      {
        reference: payload.transactionReference,
        transactionId: payload.transactionId,
        error: error.message,
      },
      'Inter-transfer second step job failed'
    )

    await this.handleFailure(payload)
  }
}
