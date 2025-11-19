import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { WebhookRequestDto } from '#mobile/webhooks/dto/webhook_request.dto'
import { WebhookResponseDto } from '#mobile/webhooks/dto/webhook_response.dto'
import { Logger } from '@adonisjs/core/logger'
import { makeRequest } from '#shared/kernel/utils/http_helpers'
import env from '#start/env'

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
   * @param {Logger} logger - The logger utility for logging information, warnings, and errors.
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly logger: Logger
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
    status: 'success' | 'failed'
  ): Promise<WebhookResponseDto> {
    this.logger.info({ status, payload }, 'Inter-transfer first webhook received')
    this.validatePayload(payload)

    const reference = payload.data.reference
    const operatorResponse = payload.data
    this.logger.debug({ reference, status }, 'Inter-transfer first webhook validated')

    const trx = await db.transaction()

    try {
      const { transaction, payments } = await this.loadEntities(reference)
      this.logger.debug(
        {
          reference,
          transaction_id: transaction.id,
          payments_count: payments.length,
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

      this.logger.debug(
        {
          reference,
          payment_id: firstPayment?.id,
          current_payment_status: firstPayment?.status,
          incoming_status: status,
          idempotent,
        },
        'Inter-transfer first step idempotency check'
      )

      if (idempotent) {
        await trx.commit()
        this.logger.info({ reference }, 'Inter-transfer first step is idempotent, acknowledging')
        return this.createSuccessResponse()
      }

      this.logger.info(
        {
          reference,
          first_payment_id: firstPayment.id,
          second_payment_id: secondPayment.id,
          status,
        },
        'Processing inter-transfer first step'
      )

      const result = await this.processFirstStep(
        transaction,
        firstPayment,
        secondPayment,
        operatorResponse,
        status,
        trx
      )

      await trx.commit()
      this.logger.info({ reference, status }, 'Inter-transfer first step processed')
      return result
    } catch (error) {
      await trx.rollback()
      this.logger.error({ err: error, payload }, 'Inter-transfer first step webhook failed')
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
      throw new Exception('Invalid payload', { status: 422, code: 'INVALID_WEBHOOK_PAYLOAD' })
    }
  }

  /**
   * Loads and returns a transaction and its associated payments based on the provided reference.
   *
   * @param {string} reference - The unique reference identifier for the transaction.
   * @return {Promise<{transaction: Transaction, payments: Payment[]}>} An object containing the transaction and an array of associated payments.
   */
  private async loadEntities(reference: string): Promise<{
    transaction: Transaction
    payments: Payment[]
  }> {
    const transaction = await this.transactionService.findByReference(reference)
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
    incomingStatus: 'success' | 'failed'
  ): boolean {
    if (payment.status === 'success' && incomingStatus === 'success') return true
    if (payment.status === 'failed' && incomingStatus === 'failed') return true
    return transaction.status !== 'pending'
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
    status: 'success' | 'failed',
    trx: TransactionClientContract
  ): Promise<WebhookResponseDto> {
    if (status === 'success') {
      this.logger.debug(
        { reference: transaction.reference, first_payment_id: firstPayment.id },
        'Marking first payment as success'
      )
      await this.paymentService.markSuccess(
        firstPayment.id,
        { operator_response: operatorResponse },
        trx
      )

      // Initiate the second transaction immediately after first success
      try {
        const details = (() => {
          try {
            const raw = (secondPayment as any)?.paymentDetails
            return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
          } catch {
            this.logger.error(
              {
                reference: transaction.reference,
                payment_id: secondPayment.id,
              },
              'Failed to get the payment details for the second payment'
            )
            return {}
          }
        })()

        const dataSend: Record<string, any> = {
          operation_type: secondPayment.paymentMethod,
          amount: Number(secondPayment.totalAmount),
          provider: details?.operator,
          number: details?.phone,
          country: 'ci',
          currency: 'XOF',
          reference: transaction.reference,
          notify_success_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_SUCCESS_URL'),
          notify_failure_url: env.get('NOTIFY_TRANSFERT_INTER_SECOND_FAILURE_URL'),
        }

        await makeRequest({
          uri: env.get('API_TRANSFERT_URL')!!,
          method: 'post',
          data: dataSend,
        })
        this.logger.info(
          {
            reference: transaction.reference,
            second_payment_id: secondPayment.id,
            provider: dataSend.provider,
            number_masked:
              typeof dataSend.number === 'string'
                ? dataSend.number.replace(/\d(?=\d{2})/g, '*')
                : dataSend.number,
          },
          'Second inter-transfer step initiated'
        )
      } catch (err) {
        this.logger.error(
          { err, step: 'initiate_second_transfer', ref: transaction.reference },
          'Failed to initiate second inter-transfer step'
        )
      }

      return this.createSuccessResponse()
    } else {
      this.logger.debug(
        {
          reference: transaction.reference,
          first_payment_id: firstPayment.id,
          second_payment_id: secondPayment.id,
        },
        'Marking first and second payments/transaction as failed'
      )
      await Promise.all([
        this.paymentService.markFailed(
          firstPayment.id,
          { operator_response: operatorResponse },
          trx
        ),
        this.paymentService.markFailed(secondPayment.id, {}, trx),
      ])
      await this.transactionService.markFailed(transaction.id, trx)
      return this.createSuccessResponse()
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
