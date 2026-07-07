import { inject } from '@adonisjs/core'
import PaymentRepository from '#core/money/transactions/domain/interfaces/payment_repository'
import Payment from '#core/money/transactions/domain/models/payment'
import Transaction from '#core/money/transactions/domain/models/transaction'
import { AccountRef } from '#core/money/transactions/domain/types/account_ref'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import { ProviderErrorDefinition } from '#shared/infrastructure/services/provider_error_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import PaymentAlreadyFailedException from '#core/money/transactions/domain/exceptions/payment_already_failed_exception'
import PaymentAlreadySuccessfulException from '#core/money/transactions/domain/exceptions/payment_already_successful_exception'
import PaymentNotFoundException from '#core/money/transactions/domain/exceptions/payment_not_found_exception'
import InvalidStatusTransitionException from '#core/money/transactions/domain/exceptions/invalid_status_transition_exception'

/**
 * Service class for handling payment-related operations.
 */
@inject()
export default class PaymentService {
  /**
   * Creates an instance of the class with the given payment repository.
   *
   * @param {PaymentRepository} paymentRepository - The repository for handling payment-related operations.
   */
  constructor(private paymentRepository: PaymentRepository) {}

  /**
   * Creates a new payment record and saves it to the database.
   *
   * @param {Object} payload - An object containing the details of the payment.
   * @param {string} payload.payment_method - The payment method used for the transaction.
   * @param {string} payload.operation_type - The type of payment operation (e.g., charge, refund).
   * @param {number} payload.amount - The base amount for the payment.
   * @param {number} payload.total_amount - The total amount including fees for the payment.
   * @param {number} [payload.fees] - The fees associated with the payment (optional).
   * @param {Object|null} [payload.payment_details] - Additional details about the payment (optional).
   * @param {string} [payload.step] - The current step of the payment process (optional).
   * @param {string} [payload.status] - The current status of the payment (optional).
   * @param {Transaction} transaction - The transaction object associated with this payment.
   * @param {AccountRef} user - The account holder who initiated the payment (contrat money).
   * @param {TransactionClientContract} [trx] - The transaction client contract for database operations (optional).
   *
   * @return {Promise<Payment>} The saved payment object.
   */
  async createPayment(
    payload: Partial<Payment> & {
      payment_method: string
      operation_type: string
      payment_details?: Record<string, any> | null
      step?: PaymentStep
      status?: PaymentStatus
    },
    transaction: Transaction,
    user: AccountRef,
    trx?: TransactionClientContract
  ): Promise<Payment> {
    transactionLog.info(
      'INIT_PAYMENT_CREATION',
      { transaction_id: transaction.id, user_id: user.id, method: payload.payment_method },
      `Creating payment '${payload.step}' for transaction ${transaction.id} by user ${user.id} with method ${payload.payment_method}`
    )
    const payment = new Payment()

    payment.transactionsId = transaction.id
    payment.transactionsUid = transaction.transactionsUid!

    payment.paymentMethod = payload.payment_method
    payment.operationType = payload.operation_type

    if (payload.payment_details)
      payment.paymentDetails = JSON.stringify(payload.payment_details as any)

    if (payload.step) payment.step = payload.step
    if (payload.status) payment.status = payload.status

    return this.paymentRepository.save(payment, trx)
  }

  async getById(id: number, trx?: TransactionClientContract): Promise<Payment> {
    const payment = await this.paymentRepository.findById(id, trx)
    if (!payment) throw new PaymentNotFoundException()
    return payment
  }

  /**
   * Marks a payment as successful by updating its status and optionally saving additional information.
   *
   * @param {string | number} id - The unique identifier of the payment to be marked as successful.
   *                                This can be a string or a numeric ID.
   * @param {Partial<Pick<Payment, 'status' | 'operatorResponse'>>} [extra] - Optional payload providing additional data
   *                                                                          such as operator response to be stored.
   * @param {TransactionClientContract} [trx] - Optional database transaction context for ensuring
   *                                             atomicity during the operation.
   * @return {Promise<Payment>} A promise that resolves to the updated Payment instance.
   * @throws {PaymentAlreadySuccessfulException} If the payment is already marked as successful.
   */
  async markSuccess(
    id: number,
    extra?: Partial<Pick<Payment, 'status' | 'operatorResponse'>>,
    trx?: TransactionClientContract
  ): Promise<Payment> {
    const payment = await this.getById(id, trx)

    if (payment.status === PaymentStatus.SUCCESS) {
      transactionLog.warn(
        'PAYMENT_ALREADY_SUCCESSFUL',
        { payment_id: payment.id, status: payment.status },
        'Payment already successful'
      )
      throw new PaymentAlreadySuccessfulException()
    }

    if (payment.status === PaymentStatus.FAILED) {
      transactionLog.warn(
        'PAYMENT_INVALID_TRANSITION',
        { payment_id: payment.id, from: payment.status, to: 'SUCCESS' },
        'Cannot mark a failed payment as successful'
      )
      throw new InvalidStatusTransitionException(payment.status, 'SUCCESS', 'payment')
    }

    payment.status = PaymentStatus.SUCCESS

    if (extra?.operatorResponse) {
      payment.operatorResponse = JSON.stringify(extra.operatorResponse)
    }

    transactionLog.info(
      'PAYMENT_MARKED_AS_SUCCESS',
      { payment_id: payment.id },
      'Payment marked as success'
    )
    return this.paymentRepository.save(payment, trx)
  }

  /**
   * Marks a payment as failed by updating its status to `FAILED`.
   * Optionally updates the operator response and saves the changes in the payment repository.
   *
   * @param {number} id - The unique identifier of the payment.
   * @param {Object} [extra] - Optional additional data to associate with the update.
   * @param {ProviderErrorDefinition} [extra.definition] - The categorized error definition.
   * @param {any} [extra.operatorResponse] - The raw response from the operator.
   * @param {any} [extra.error] - The raw error details.
   * @param {TransactionClientContract} [trx] - Optional database transaction for persisting the changes.
   *
   * @return {Promise<Payment>} A promise that resolves to the updated payment object.
   *
   * @throws {PaymentAlreadyFailedException} If the payment is already marked as `FAILED`.
   */
  async markFailed(
    id: number,
    extra?: {
      definition?: ProviderErrorDefinition
      operatorResponse?: any
      status?: PaymentStatus
    },
    trx?: TransactionClientContract
  ): Promise<Payment> {
    const payment = await this.getById(id, trx)

    if (payment.status === PaymentStatus.FAILED) {
      transactionLog.info(
        'PAYMENT_ALREADY_FAILED',
        { payment_id: payment.id },
        'Payment already failed'
      )
      throw new PaymentAlreadyFailedException()
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      transactionLog.warn(
        'PAYMENT_INVALID_TRANSITION',
        { payment_id: payment.id, from: payment.status, to: 'FAILED' },
        'Cannot mark a successful payment as failed'
      )
      throw new InvalidStatusTransitionException(payment.status, 'FAILED', 'payment')
    }

    payment.status = PaymentStatus.FAILED

    if (extra?.definition) {
      payment.errorCode = extra.definition.code
      payment.errorCategory = extra.definition.category
      payment.adminAction = extra.definition.adminAction
      payment.userMessage = extra.definition.userMessage
      payment.adminMessage = extra.definition.adminMessage
    }

    if (extra?.operatorResponse) {
      payment.operatorResponse = JSON.stringify(extra.operatorResponse as any)
    }

    transactionLog.info(
      'PAYMENT_MARKED_AS_FAILED',
      { payment: { id: payment.id }, category: payment.errorCategory },
      'Payment marked as failed'
    )
    return this.paymentRepository.save(payment, trx)
  }

  /**
   * Finds payments associated with a given transaction ID or UID.
   *
   * @param {number|string} transactionIdOrUid - The ID or UID of the transaction to find associated payments for.
   * @param trx
   * @return {Promise<Payment[]>} A promise that resolves to an array of payments related to the given transaction.
   */
  async findByTransaction(
    transactionIdOrUid: number | string,
    trx?: TransactionClientContract
  ): Promise<Payment[]> {
    transactionLog.debug(
      'PAYMENT_LOOKUP_BY_TRANSACTION',
      { transaction: { ref: transactionIdOrUid } },
      'Finding payments by transaction'
    )

    const payments = await this.paymentRepository.findByTransaction(transactionIdOrUid, trx)

    transactionLog.debug(
      'PAYMENTS_FOUND',
      { payments: { count: payments.length } },
      'Payments found for transaction'
    )
    return payments
  }

  /**
   * Parses the payment details JSON from a payment object.
   *
   * @param {Payment} payment - The payment whose details should be parsed.
   * @return {Record<string, any>} The parsed details, or an empty object if parsing fails.
   */
  parsePaymentDetails(payment: Payment): Record<string, any> {
    try {
      const raw = payment.paymentDetails
      return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
    } catch {
      return {}
    }
  }

  /**
   * Extracts the beneficiary phone number from a payment's details.
   *
   * @param {Payment} payment - The payment to extract the phone from.
   * @return {string} The phone number, or 'unknown' if unavailable.
   */
  extractBeneficiaryPhone(payment: Payment): string {
    const details = this.parsePaymentDetails(payment)
    return details?.phone || 'unknown'
  }
}
