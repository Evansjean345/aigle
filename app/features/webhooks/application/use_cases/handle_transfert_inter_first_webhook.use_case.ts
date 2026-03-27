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
import InitiateInterTransferSecondStepJob from '#features/webhooks/application/jobs/initiate_inter_transfer_second_step_job'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import BaseWebhookHandler, {
  WEBHOOK_SUCCESS_RESPONSE,
} from '#features/webhooks/application/use_cases/base_webhook_handler'

@inject()
export default class HandleTransfertInterFirstWebhookUseCase extends BaseWebhookHandler {
  /**
   * Constructs an instance of the class and initializes the necessary services.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment-related operations.
   * @param {TransactionService} transactionService - The service responsible for handling transaction-related operations.
   */
  constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService
  ) {
    super()
  }

  /**
   * Executes the inter-transfer process for the first webhook step.
   * Handles database transactions, processes the first payment status,
   * and optionally initiates the second step based on the status of the first payment.
   *
   * @param {WebhookRequestDto} payload - The webhook request data containing transaction details.
   * @param {TransactionStatus} status - The current transactional status (e.g., SUCCESS, FAILED).
   * @return {Promise<WebhookResponseDto>} A promise resolving to the response for the webhook execution.
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

    /**
     * A boolean flag that determines whether the second step of a process
     * should be initiated. When set to `true`, the process proceeds
     * to the second step; when `false`, the process halts or remains
     * on the current step.
     */
    const { shouldInitiateSecondStep, transaction, secondPayment } = await this.withTransaction(
      async (trx) => {
        const {
          firstPayment,
          secondPayment: second,
          transaction: txn,
        } = await this.loadInterPayments(reference, trx)

        if (this.isIdempotent(txn, firstPayment, status)) {
          paymentLog.warn(
            'INTER_TRANSFER_FIRST_IDEMPOTENT',
            { webhook: { reference } },
            'Inter-transfer first step is idempotent, acknowledging'
          )
          return { shouldInitiateSecondStep: false, transaction: txn, secondPayment: second }
        }

        switch (status) {
          case TransactionStatus.SUCCESS:
            await this.paymentService.markSuccess(firstPayment.id, operatorResponse, trx)
            break
          case TransactionStatus.FAILED:
            await this.markAllFailed(txn, firstPayment, second, operatorResponse, trx)
            break
          default:
            throw new Exception('Invalid transaction status', {
              status: 400,
              code: 'INVALID_TRANSACTION_STATUS',
            })
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

    if (shouldInitiateSecondStep) {
      await this.enqueueSecondStep(transaction, secondPayment)
    }

    return WEBHOOK_SUCCESS_RESPONSE
  }

  /**
   * Loads and validates inter-transfer payments associated with the given reference.
   *
   * @param {string} reference - The reference identifier used to fetch the transaction and payments.
   * @param {TransactionClientContract} trx - The transaction client used to query the database.
   * @return {Promise<{transaction: Transaction, firstPayment: Payment, secondPayment: Payment}>}
   *         The transaction and the first two associated payments.
   * @throws {Exception} If fewer than two payments are associated with the transaction.
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

  /**
   * Determines if the given transaction and payment combination is idempotent based on their statuses.
   *
   * @param {Transaction} transaction - The transaction object to be evaluated.
   * @param {Payment} payment - The payment object associated with the transaction.
   * @param {TransactionStatus} incomingStatus - The current status of the transaction being checked.
   * @return {boolean} Returns true if the combination of transaction and payment statuses is idempotent; otherwise, false.
   */
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
   * Marks the given transaction and associated payments as failed.
   *
   * @param {Transaction} transaction - The main transaction object to be marked as failed.
   * @param {Payment} firstPayment - The first associated payment to be marked as failed.
   * @param {Payment} secondPayment - The second associated payment to be marked as failed.
   * @param {any} operatorResponse - The response provided by the operator, used for the first payment.
   * @param {TransactionClientContract} trx - The transaction client instance for executing database operations.
   * @return {Promise<void>} A promise that resolves once all the operations are completed.
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
   * Enqueues the second step of an inter-transfer as a BullMQ job.
   * The job handles the HTTP call, failure recovery, and admin alerting.
   *
   * @param {Transaction} transaction - The transaction for the inter-transfer.
   * @param {Payment} secondPayment - The second payment containing beneficiary details.
   * @return {Promise<void>} Resolves when the job is enqueued.
   */
  private async enqueueSecondStep(transaction: Transaction, secondPayment: Payment): Promise<void> {
    const details = this.paymentService.parsePaymentDetails(secondPayment)

    await InitiateInterTransferSecondStepJob.dispatch({
      transactionId: transaction.id,
      transactionReference: transaction.reference,
      secondPaymentId: secondPayment.id,
      totalAmount: Number(transaction.totalAmount),
      paymentMethod: secondPayment.paymentMethod,
      operator: details?.operator || '',
      phone: details?.phone || '',
    }).toQueue('payment').priority(1)

    paymentLog.info(
      'INTER_TRANSFER_SECOND_STEP_ENQUEUED',
      {
        reference: transaction.reference,
        paymentId: secondPayment.id,
      },
      'Second inter-transfer step enqueued as job'
    )
  }
}
