import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Payment from '#features/transactions/domain/models/payment'
import PaymentRepository from '#features/transactions/domain/interfaces/payment_repository'

export default class PaymentRepositoryImpl implements PaymentRepository {
  async save(payment: Payment, trx?: TransactionClientContract): Promise<Payment> {
    if (trx) return payment.useTransaction(trx).save()
    return payment.save()
  }

  /**
   * Finds a payment record by its unique identifier (UID) or numeric ID.
   *
   * @param {string | number} id - The unique identifier (UID) or numeric ID of the payment.
   * @param {TransactionClientContract} [trx] - Optional transaction client for executing the query.
   * @return {Promise<Payment | null>} A promise that resolves to the payment record if found, or null if not found.
   */
  async findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Payment | null> {
    const query = Payment.query({ client: trx }).where((builder) => {
      builder.where('payments_uid', id).orWhere('id', id)
    })

    if (trx) {
      query.forUpdate()
    }

    return query.first()
  }

  /**
   * Finds a payment record by its unique identifier.
   *
   * @param {number} id - The unique identifier of the payment record to retrieve.
   * @param {TransactionClientContract} [trx] - An optional database transaction object for query scoping.
   * @return {Promise<Payment|null>} A promise that resolves to the payment record if found, or null if no record exists.
   */
  async findById(id: number, trx?: TransactionClientContract): Promise<Payment | null> {
    const query = Payment.query({ client: trx }).where('id', id)

    if (trx) {
      query.forUpdate()
    }

    return query.first()
  }

  async findByTransaction(
    transactionIdOrUid: number | string,
    trx?: TransactionClientContract
  ): Promise<Payment[]> {
    const query = Payment.query({ client: trx }).where(
      'transactions_uid',
      String(transactionIdOrUid)
    )

    if (trx) {
      query.forUpdate()
    }

    return query
  }
}
