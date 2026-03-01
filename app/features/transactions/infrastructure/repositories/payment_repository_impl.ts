import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Payment from '#features/transactions/domain/models/payment'
import PaymentRepository from '#features/transactions/domain/interfaces/payment_repository'

export default class PaymentRepositoryImpl implements PaymentRepository {
  async save(payment: Payment, trx?: TransactionClientContract): Promise<Payment> {
    if (trx) return payment.useTransaction(trx).save()
    return payment.save()
  }

  async findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Payment | null> {
    const query = Payment.query({ client: trx }).where('payments_uid', id).orWhere('id', id)

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
