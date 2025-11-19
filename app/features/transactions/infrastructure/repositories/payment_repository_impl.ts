import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Payment from '#shared/models/payment'
import PaymentRepository from '#shared/interfaces/repositories/payment.repository'

/**
 * Implementation of the PaymentRepository interface,
 * responsible for handling database operations related to payments.
 */
export default class PaymentRepositoryImpl implements PaymentRepository {
  /**
   * Saves the given payment instance to the database. If a transaction is provided,
   * it uses the transaction context for saving the payment.
   *
   * @param {Payment} payment - The payment instance to be saved.
   * @param {TransactionClientContract} [trx] - Optional transaction client to be used for saving.
   *
   * @return {Promise<Payment>} A promise that resolves to the saved payment instance.
   */
  async save(payment: Payment, trx?: TransactionClientContract): Promise<Payment> {
    if (trx) return payment.useTransaction(trx).save()
    return payment.save()
  }
  /**
   * Retrieves a payment record by its UID or ID.
   *
   * @param {string | number} id - The unique identifier for the payment, which can be a string or a number.
   * @return {Promise<Payment | null>} A promise that resolves to the payment record if found, or null if no record matches the given UID or ID.
   */
  async findByUidOrId(id: string | number): Promise<Payment | null> {
    return Payment.query().where('payments_uid', id).orWhere('id', id).first()
  }
  /**
   * Retrieves a payment record by transaction ID or UID.
   *
   * @param {number | string} transactionIdOrUid - The transaction ID or UID to search for. Can be a numeric ID or a string UID.
   * @return {Promise<Payment[] | null>} A promise that resolves to a Payment object if found, otherwise null.
   */
  async findByTransaction(transactionIdOrUid: number | string): Promise<Payment[]> {
    return Payment.query().where('transactions_uid', String(transactionIdOrUid))
  }
}
