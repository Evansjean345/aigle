import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Refund from '#features/transactions/domain/models/refund'
import RefundRepository from '#features/transactions/domain/interfaces/refund_repository'

export default class RefundRepositoryImpl implements RefundRepository {
  async create(data: Partial<Refund>, trx?: TransactionClientContract): Promise<Refund> {
    const refund = new Refund()
    Object.assign(refund, data)

    if (trx) {
      return await refund.useTransaction(trx).save()
    }

    return await refund.save()
  }

  async findByTransactionId(transactionId: number): Promise<Refund | null> {
    return await Refund.query().where('transactionId', transactionId).first()
  }
}
