import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'

export default class TransferBatchRepositoryImpl implements TransferBatchRepository {
  async create(
    data: Partial<TransferBatch>,
    trx?: TransactionClientContract
  ): Promise<TransferBatch> {
    const batch = new TransferBatch()
    batch.merge(data)
    if (trx) batch.useTransaction(trx)
    return batch.save()
  }

  async findByIdempotencyKey(
    key: string,
    trx?: TransactionClientContract
  ): Promise<TransferBatch | null> {
    const query = TransferBatch.query()
    if (trx) query.useTransaction(trx)
    return query.where('idempotency_key', key).first()
  }

  async findById(batchId: number, trx?: TransactionClientContract): Promise<TransferBatch | null> {
    const query = TransferBatch.query()
    if (trx) query.useTransaction(trx)
    return query.where('id', batchId).first()
  }

  async findByReferenceForUpdate(
    reference: string,
    trx: TransactionClientContract
  ): Promise<TransferBatch | null> {
    return TransferBatch.query()
      .useTransaction(trx)
      .where('reference', reference)
      .forUpdate()
      .first()
  }

  async findByReference(reference: string): Promise<TransferBatch | null> {
    return TransferBatch.query().where('reference', reference).first()
  }

  async listByAccount(accountId: string, status?: string): Promise<TransferBatch[]> {
    const query = TransferBatch.query().where('account_id', accountId)
    if (status) query.where('status', status)
    return query.orderBy('created_at', 'desc')
  }

  async update(
    batchId: number,
    patch: Partial<TransferBatch>,
    trx?: TransactionClientContract
  ): Promise<void> {
    const batch = await TransferBatch.findOrFail(batchId)
    if (trx) batch.useTransaction(trx)
    batch.merge(patch)
    await batch.save()
  }

  async incrementSettlementCounter(
    batchId: number,
    outcome: 'success' | 'failure',
    trx: TransactionClientContract
  ): Promise<TransferBatch> {
    const batch = await TransferBatch.query()
      .useTransaction(trx)
      .where('id', batchId)
      .forUpdate()
      .firstOrFail()

    if (outcome === 'success') batch.successfulCount += 1
    else batch.failedCount += 1

    if (batch.status === TransferBatchStatus.QUEUED) batch.status = TransferBatchStatus.PROCESSING

    await batch.save()
    return batch
  }
}
