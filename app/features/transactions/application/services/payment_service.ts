import { inject } from '@adonisjs/core'
import PaymentRepository from '#features/transactions/domain/interfaces/payment_repository'
import Payment from '#features/transactions/domain/models/payment'
import Transaction from '#features/transactions/domain/models/transaction'
import User from '#features/users/domain/models/user'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import { Logger } from '@adonisjs/core/logger'

/**
 * Service class for handling payment-related operations.
 */
@inject()
export default class PaymentService {
  /**
   * Creates an instance of the class with the given payment repository.
   *
   * @param {PaymentRepository} paymentRepository - The repository for handling payment-related operations.
   * @param {Logger} logger - Application logger for structured logging.
   */
  constructor(
    private paymentRepository: PaymentRepository,
    private readonly logger: Logger
  ) {}

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
   * @param {User} user - The user who initiated the payment.
   * @param {TransactionClientContract} [trx] - The transaction client contract for database operations (optional).
   *
   * @return {Promise<Payment>} The saved payment object.
   */
  async createPayment(
    payload: Partial<Payment> & {
      payment_method: string
      operation_type: string
      amount: number
      total_amount: number
      fees?: number
      payment_details?: Record<string, any> | null
      step?: string
      status?: Payment['status']
    },
    transaction: Transaction,
    user: User,
    trx?: TransactionClientContract
  ): Promise<Payment> {
    this.logger.info(
      { transaction_id: transaction.id, user_id: user.id, method: payload.payment_method },
      'Creating payment'
    )
    const payment = new Payment()

    payment.usersId = user.id
    payment.usersUid = user.usersUid!

    payment.transactionsId = transaction.id
    payment.transactionsUid = transaction.transactionsUid!

    payment.paymentMethod = payload.payment_method
    payment.operationType = payload.operation_type

    payment.fees = Number(payload.fees || transaction.fees || 0)
    payment.amount = Number(payload.amount)
    payment.totalAmount = Number(payload.total_amount)

    if (payload.payment_details)
      payment.paymentDetails = JSON.stringify(payload.payment_details as any)

    if (payload.step) payment.step = payload.step
    if (payload.status) payment.status = payload.status

    return this.paymentRepository.save(payment, trx)
  }

  /**
   * Retrieves a payment record based on the provided UID or ID.
   *
   * @param {string | number} id - The unique identifier (UID) or numeric ID of the payment.
   * @return {Promise<Payment>} Returns a promise that resolves to the payment record.
   * @throws {Exception} Throws an exception if no payment is found with the provided UID or ID.
   */
  async getByUidOrId(id: string | number): Promise<Payment> {
    const payment = await this.paymentRepository.findByUidOrId(id)
    if (!payment)
      throw new Exception('Payment not found', { status: 404, code: 'PAYMENT_NOT_FOUND' })
    return payment
  }

  /**
   * Marks the payment as successful by updating its status and additional properties if provided.
   *
   * @param {string | number} id - The identifier of the payment, which can be either a string or a number.
   * @param {Object} [extra] - Optional additional fields to update during the status change.
   * @param {string} [extra.operator_response] - The response received from the operator.
   * @param {string} [extra.url_operator] - The URL associated with the operator.
   * @param {string} [extra.status] - The new status of the payment (should match 'success' validation).
   * @param {TransactionClientContract} [trx] - Optional database transaction object to perform the update within a transaction.
   * @return {Promise<Payment>} A promise that resolves to the updated Payment object after marking it as successful.
   * @throws {Exception} Throws an exception if the payment is already marked as successful.
   */
  async markSuccess(
    id: string | number,
    extra?: Partial<Pick<Payment, 'operator_response' | 'url_operator' | 'status'>>,
    trx?: TransactionClientContract
  ): Promise<Payment> {
    const payment = await this.getByUidOrId(id)

    if (payment.status === 'success') {
      this.logger.info({ payment_id: payment.id }, 'Payment already successful')
      throw new Exception('Payment already successful', {
        status: 400,
        code: 'PAYMENT_ALREADY_SUCCESSFUL',
      })
    }

    payment.status = 'success'

    if (extra?.operator_response) {
      payment.operatorResponse = JSON.stringify(extra.operator_response)
    }

    if (extra?.url_operator) {
      payment.urlOperator = extra.url_operator || undefined
    }

    this.logger.info({ payment_id: payment.id }, 'Payment marked as success')
    return this.paymentRepository.save(payment, trx)
  }

  /**
   * Marks a payment as failed.
   *
   * Updates the status of a payment to 'failed'. Optionally, the operator response and other
   * additional details may be provided. Throws an exception if the payment is already
   * marked as failed.
   *
   * @param {string | number} id - The unique identifier of the payment (can be either a UID or an ID).
   * @param {Partial<Pick<Payment, 'operator_response' | 'status'>>} [extra] - Optional additional data, including operator response or status changes.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<Payment>} A promise that resolves with the updated payment object.
   * @throws {Exception} If the payment is already marked as failed.
   */
  async markFailed(
    id: string | number,
    extra?: Partial<Pick<Payment, 'operator_response' | 'status'>>,
    trx?: TransactionClientContract
  ): Promise<Payment> {
    const payment = await this.getByUidOrId(id)

    if (payment.status === 'failed') {
      this.logger.info({ payment_id: payment.id }, 'Payment already failed')
      throw new Exception('Payment already failed', { status: 400, code: 'PAYMENT_ALREADY_FAILED' })
    }

    payment.status = 'failed'

    if (extra?.operator_response) {
      payment.operatorResponse = JSON.stringify(extra.operator_response as any)
    }

    this.logger.info({ payment_id: payment.id }, 'Payment marked as failed')
    return this.paymentRepository.save(payment, trx)
  }

  /**
   * Finds and retrieves a transaction record based on the provided transaction ID or UID.
   *
   * @param {number|string} transactionIdOrUid - The transaction ID (number) or UID (string) to search for in the payment repository.
   * @return {Promise<Payment | null>} A promise that resolves to the transaction record if found, or null if no record matches the provided identifier.
   */
  async findByTransaction(transactionIdOrUid: number | string): Promise<Payment[]> {
    this.logger.debug({ transaction_ref: transactionIdOrUid }, 'Finding payments by transaction')
    const payments = await this.paymentRepository.findByTransaction(transactionIdOrUid)
    this.logger.debug({ count: payments.length }, 'Payments found for transaction')
    return payments
  }
}
