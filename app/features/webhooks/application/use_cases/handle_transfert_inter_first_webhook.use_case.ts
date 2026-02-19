import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import Payment from '#features/transactions/domain/models/payment'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import env from '#start/env'
import HttpClient from '#shared/infrastructure/http_client_service'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { maskPhone } from '#shared/utils/utiles'
import BaseWebhookHandler, {
  WEBHOOK_SUCCESS_RESPONSE,
} from '#features/webhooks/application/use_cases/base_webhook_handler'

@inject()
export default class HandleTransfertInterFirstWebhookUseCase extends BaseWebhookHandler {
  /**
   * Constructs an instance of the class and initializes its dependencies.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment-related operations.
   * @param {TransactionService} transactionService - The service managing transaction-related processes.
   * @param {HttpClient} httpClient - The client used for making HTTP requests.
   */
  constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService,
    private readonly httpClient: HttpClient
  ) {
    super()
  }

  /**
   * Executes the processing of a webhook request for an inter-transfer transaction.
   * Handles validation, processing the first step of the transaction, and initiating
   * the second step if applicable.
   *
   * @param {WebhookRequestDto} payload - The webhook request data containing transaction details.
   * @param {TransactionStatus} status - The status of the transaction (e.g., SUCCESS, FAILED).
   * @return {Promise<WebhookResponseDto>} A promise resolving to the webhook response indicating success or failure.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const reference = payload.data.reference
    const operatorResponse = { operatorResponse: payload.data } as any

    paymentLog.info(
      'INTER_TRANSFER_FIRST_WEBHOOK_RECEIVED',
      { webhook: { status, reference } },
      'Inter-transfer first webhook received'
    )

    // 1. Traitement DB dans une transaction
    const { shouldInitiateSecondStep, transaction, secondPayment } = await this.withTransaction(
      async (trx) => {
        const {
          firstPayment,
          secondPayment: second,
          transaction: txn,
        } = await this.loadInterPayments(reference, trx)

        if (this.isIdempotent(txn, firstPayment, status)) {
          paymentLog.info(
            'INTER_TRANSFER_FIRST_IDEMPOTENT',
            { webhook: { reference } },
            'Inter-transfer first step is idempotent, acknowledging'
          )
          return { shouldInitiateSecondStep: false, transaction: txn, secondPayment: second }
        }

        if (status === TransactionStatus.SUCCESS) {
          await this.paymentService.markSuccess(firstPayment.id, operatorResponse, trx)
        } else if (status === TransactionStatus.FAILED) {
          await this.markAllFailed(txn, firstPayment, second, operatorResponse, trx)
        }

        paymentLog.info(
          'INTER_TRANSFER_FIRST_PROCESSED',
          { webhook: { reference, status } },
          'Inter-transfer first step processed'
        )

        return {
          shouldInitiateSecondStep: status === TransactionStatus.SUCCESS,
          transaction: txn,
          secondPayment: second,
        }
      }
    )

    // 2. Après commit, lancer la deuxième étape si succès
    if (shouldInitiateSecondStep) {
      await this.initiateSecondStep(transaction, secondPayment)
    }

    return WEBHOOK_SUCCESS_RESPONSE
  }

  /**
   * Loads inter-transfer payments for a given transaction reference.
   *
   * @param {string} reference - The unique reference of the transaction to load.
   * @param {TransactionClientContract} trx - The database transaction client.
   * @return {Promise<{ transaction: Transaction, firstPayment: Payment, secondPayment: Payment }>}
   *         A promise that resolves to an object containing the transaction, first payment, and second payment.
   * @throws {Exception} If the payments structure is invalid and contains fewer than two payments.
   */
  private async loadInterPayments(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; firstPayment: Payment; secondPayment: Payment }> {
    const { transaction, payments } = await this.loadTransactionWithPayments(reference, trx)

    if (payments.length < 2) {
      throw new Exception('Invalid inter-transfer payments structure', {
        status: 400,
        code: 'INTER_TRANSFER_INVALID_PAYMENTS',
      })
    }

    return { transaction, firstPayment: payments[0], secondPayment: payments[1] }
  }

  protected override isIdempotent(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    if (incomingStatus === TransactionStatus.SUCCESS) {
      return payment.status === PaymentStatus.SUCCESS
    }

    return (
      transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
    )
  }

  /**
   * Marks the transaction and associated payments as failed.
   *
   * @param {Transaction} transaction - The transaction to be marked as failed.
   * @param {Payment} firstPayment - The first payment associated with the transaction.
   * @param {Payment} secondPayment - The second payment associated with the transaction.
   * @param {any} operatorResponse - The response or data from the operator used for failure details.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async markAllFailed(
    transaction: Transaction,
    firstPayment: Payment,
    secondPayment: Payment,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkTransactionFailed(transaction.id, trx)

    await Promise.all([
      this.paymentService.markFailed(firstPayment.id, operatorResponse, trx),
      this.paymentService.markFailed(secondPayment.id, {}, trx),
    ])
  }

  /**
   * Initiates the second step of an inter-transfer process using the provided transaction and payment details.
   *
   * @param {Transaction} transaction - The primary transaction object containing details such as the total amount and reference.
   * @param {Payment} secondPayment - The payment object that includes information about the payment method and associated identifiers.
   * @return {Promise<void>} A promise that resolves when the second step of the transfer process is successfully initiated or logs an error if it fails.
   */
  private async initiateSecondStep(
    transaction: Transaction,
    secondPayment: Payment
  ): Promise<void> {
    try {
      const details = this.parsePaymentDetails(secondPayment)

      const dataSend = {
        operation_type: secondPayment.paymentMethod,
        amount: Number(transaction.totalAmount),
        provider: details?.operator,
        number: details?.phone,
        country: 'ci',
        currency: 'XOF',
        reference: transaction.reference,
        notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_SUCCESS_URL'),
        notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_FAILURE_URL'),
      }

      await this.httpClient.post(env.get('API_TRANSFERT_URL')!!, dataSend)

      paymentLog.info(
        'INTER_TRANSFER_SECOND_INITIATED',
        {
          transaction: { reference: transaction.reference },
          payment: { id: secondPayment.id },
          transfer: { provider: dataSend.provider, numberMasked: maskPhone(dataSend.number) },
        },
        'Second inter-transfer step initiated'
      )
    } catch (err) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_INIT_FAILED',
        {
          transaction: { reference: transaction.reference },
          error: { message: err instanceof Error ? err.message : 'Unknown error' },
        },
        'Failed to initiate second inter-transfer step'
      )
    }
  }

  /**
   * Parses the payment details from the provided payment object.
   *
   * @param payment The Payment object containing the details to parse.
   * @return A record containing the parsed payment details. If an error occurs during parsing, an empty object is returned.
   */
  private parsePaymentDetails(payment: Payment): Record<string, any> {
    try {
      const raw = (payment as any)?.paymentDetails
      return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
    } catch {
      return {}
    }
  }
}
