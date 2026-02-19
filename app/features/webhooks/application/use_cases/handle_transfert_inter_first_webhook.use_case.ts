import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
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
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import { maskPhone } from '#shared/utils/utiles'

/**
 * Use the case responsible for handling the first webhook of an inter-transfer transaction.
 */
@inject()
export default class HandleTransfertInterFirstWebhookUseCase {
  /**
   * Creates an instance of the class with provided dependencies.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment operations.
   * @param {TransactionService} transactionService - The service responsible for managing transactions.
   * @param {HttpClient} httpClient - The HTTP client for external API calls.
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly httpClient: HttpClient
  ) {}

  /**
   * Executes the first step of the inter-transfer webhook processing.
   *
   * @param {WebhookRequestDto} payload - The data payload received from the webhook, containing the transaction reference and associated data.
   * @param {'success' | 'failed'} status - The status of the webhook process, indicating whether the operation was successful or failed.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to the resulting response object containing the processed status and relevant data.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    paymentLog.info(
      'INTER_TRANSFER_FIRST_WEBHOOK_RECEIVED',
      { webhook: { status, reference: payload.data?.reference } },
      'Inter-transfer first webhook received'
    )
    this.validatePayload(payload)

    const reference = payload.data.reference
    const operatorResponse = payload.data
    paymentLog.debug(
      'INTER_TRANSFER_FIRST_VALIDATED',
      { webhook: { reference, status } },
      'Inter-transfer first webhook validated'
    )

    const trx = await db.transaction()

    try {
      const { transaction, payments } = await this.loadEntities(reference, trx)
      paymentLog.debug(
        'INTER_TRANSFER_FIRST_ENTITIES_LOADED',
        {
          webhook: { reference },
          transaction: { id: transaction.id },
          payments: { count: payments.length },
        },
        'Loaded transaction and payments for inter-transfer first step'
      )

      const firstPayment = payments[0]
      const secondPayment = payments[1]

      if (!firstPayment || !secondPayment) {
        throw new Exception('Invalid inter-transfer payments structure', {
          status: 400,
          code: 'INTER_TRANSFER_INVALID_PAYMENTS',
        })
      }

      const idempotent = this.isIdempotentRequest(transaction, firstPayment, status)

      paymentLog.debug(
        'INTER_TRANSFER_FIRST_IDEMPOTENCY_CHECK',
        {
          webhook: { reference, incomingStatus: status },
          payment: { id: firstPayment?.id, status: firstPayment?.status },
          idempotent,
        },
        'Inter-transfer first step idempotency check'
      )

      if (idempotent) {
        await trx.commit()
        paymentLog.info(
          'INTER_TRANSFER_FIRST_IDEMPOTENT',
          { webhook: { reference } },
          'Inter-transfer first step is idempotent, acknowledging'
        )
        return this.createSuccessResponse()
      }

      paymentLog.info(
        'INTER_TRANSFER_FIRST_PROCESSING',
        {
          webhook: { reference, status },
          payments: { firstId: firstPayment.id, secondId: secondPayment.id },
        },
        'Processing inter-transfer first step'
      )

      // 1. Mise à jour de la base de données uniquement
      await this.processFirstStep(
        transaction,
        firstPayment,
        secondPayment,
        operatorResponse,
        status,
        trx
      )

      // 2. Validation définitive des changements en DB
      await trx.commit()

      paymentLog.info(
        'INTER_TRANSFER_FIRST_SUCCESS',
        { webhook: { reference, status } },
        'Inter-transfer first step processed'
      )

      // 3. Lancement de la deuxième étape SEULEMENT après le succès du commit
      if (status === TransactionStatus.SUCCESS) {
        await this.initiateSecondStep(transaction, secondPayment)
      }

      return this.createSuccessResponse()
    } catch (error) {
      if (!trx.isCompleted) {
        await trx.rollback()
      }

      throw error
    }
  }

  /**
   * Validates the provided webhook payload to ensure it contains all required fields.
   *
   * @param {WebhookRequestDto} payload - The webhook payload object to be validated.
   * @return {void} This method does not return a value but throws an exception if the payload is invalid.
   * @throws {Exception} Throws an exception if the payload is missing the required reference field or is otherwise invalid.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload?.data?.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        {
          webhook: payload?.data,
        },
        'Missing reference in inter-transfer first webhook'
      )
      throw new Exception('Invalid payload: Missing reference', {
        status: 422,
        code: 'INVALID_WEBHOOK_PAYLOAD',
      })
    }

    if (!payload?.data?.status) {
      paymentLog.warn(
        'WEBHOOK_STATUS_REQUIRED',
        {
          webhook: payload?.data,
        },
        'Missing status in inter-transfer first webhook'
      )
      throw new Exception('Invalid payload: Missing status', {
        status: 422,
        code: 'INVALID_WEBHOOK_PAYLOAD',
      })
    }
  }

  /**
   * Loads and returns a transaction and its associated payments based on the provided reference.
   *
   * @param {string} reference - The unique reference identifier for the transaction.
   * @param {TransactionClientContract} trx - The transaction client contract.
   * @return {Promise<{transaction: Transaction, payments: Payment[]}>} An object containing the transaction and an array of associated payments.
   */
  private async loadEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{
    transaction: Transaction
    payments: Payment[]
  }> {
    const transaction = await Transaction.query({
      client: trx,
    })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid)
    return { transaction, payments }
  }

  /**
   * Determines if a request is idempotent based on transaction, payment, and incoming status.
   *
   * @param {Transaction} transaction - The transaction object to evaluate.
   * @param {Payment} payment - The payment object to evaluate.
   * @param {'success' | 'failed'} incomingStatus - The status of an incoming request.
   * @return {boolean} Returns true if the request is idempotent, otherwise false.
   */
  private isIdempotentRequest(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    const isIncomingSuccess = incomingStatus === TransactionStatus.SUCCESS

    if (isIncomingSuccess) {
      return payment.status === PaymentStatus.SUCCESS
    } else {
      return (
        transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
      )
    }
  }

  /**
   * Processes the first step of a transaction, which involves handling payments and responses based on the provided status.
   * Updates payment statuses, initiates a second payment if the first step is successful, and handles operator responses.
   *
   * @param {Transaction} transaction - The transaction object representing the overall payment transaction.
   * @param {Payment} firstPayment - The first payment object being processed in the transaction flow.
   * @param {Payment} secondPayment - The second payment object to be handled after the first payment succeeds.
   * @param {any} operatorResponse - The response data received from the payment operator for the current transaction.
   * @param {'success' | 'failed'} status - The status of the transaction step, indicating success or failure.
   * @param {TransactionClientContract} trx - The transaction client contract for database operations within the scope of the transaction.
   * @return {Promise<WebhookResponseDto>} Returns a promise resolving to a WebhookResponseDto object indicating the transaction outcome.
   */
  private async processFirstStep(
    transaction: Transaction,
    firstPayment: Payment,
    secondPayment: Payment,
    operatorResponse: any,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    if (status === TransactionStatus.SUCCESS) {
      paymentLog.debug(
        'INTER_TRANSFER_FIRST_MARKING_SUCCESS',
        { transaction: { reference: transaction.reference }, payment: { id: firstPayment.id } },
        'Marking first payment as success'
      )
      await this.paymentService.markSuccess(
        firstPayment.id,
        { operatorResponse: operatorResponse },
        trx
      )
    } else if (status === TransactionStatus.FAILED) {
      paymentLog.debug(
        'INTER_TRANSFER_FIRST_MARKING_FAILED',
        {
          transaction: { reference: transaction.reference },
          payments: { firstId: firstPayment.id, secondId: secondPayment.id },
        },
        'Marking first and second payments/transaction as failed'
      )

      await this.transactionService.markFailed(transaction.id, trx)

      await Promise.all([
        this.paymentService.markFailed(
          firstPayment.id,
          { operatorResponse: operatorResponse },
          trx
        ),
        this.paymentService.markFailed(secondPayment.id, {}, trx),
      ])
    }
  }

  /**
   * Initiates the second step of the inter-transfer transaction by making an external API call.
   *
   * @param {Transaction} transaction - The transaction object.
   * @param {Payment} secondPayment - The second payment object.
   * @return {Promise<void>}
   */
  private async initiateSecondStep(
    transaction: Transaction,
    secondPayment: Payment
  ): Promise<void> {
    try {
      const details = (() => {
        try {
          const raw = (secondPayment as any)?.paymentDetails
          return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
        } catch {
          paymentLog.error(
            'INTER_TRANSFER_FIRST_PARSE_ERROR',
            {
              transaction: { reference: transaction.reference },
              payment: { id: secondPayment.id },
            },
            'Failed to get the payment details for the second payment'
          )
          return {}
        }
      })()

      const dataSend: Record<string, any> = {
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
          transfer: {
            provider: dataSend.provider,
            numberMasked: maskPhone(dataSend.number),
          },
        },
        'Second inter-transfer step initiated'
      )
    } catch (err) {
      // TODO: Notify the admin about the payment failed //

      errorLog.error(
        'INTER_TRANSFER_SECOND_INIT_FAILED',
        {
          transaction: { reference: transaction.reference },
          error: { message: (err as any)?.message || 'Unknown error' },
        },
        'Failed to initiate second inter-transfer step'
      )
    }
  }
  /**
   * Creates and returns a success response indicating the request has been received.
   *
   * @return {WebhookResponseDto} An object containing the status code and message for a successful response.
   */
  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
