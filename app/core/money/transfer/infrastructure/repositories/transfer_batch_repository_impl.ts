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
    return TransferBatch.query(trx ? { client: trx } : undefined)
      .where('idempotency_key', key)
      .first()
  }

  async findById(batchId: number, trx?: TransactionClientContract): Promise<TransferBatch | null> {
    return TransferBatch.query(trx ? { client: trx } : undefined)
      .where('id', batchId)
      .first()
  }

  async findByReferenceForUpdate(
    reference: string,
    trx: TransactionClientContract
  ): Promise<TransferBatch | null> {
    return TransferBatch.query({ client: trx }).where('reference', reference).forUpdate().first()
  }

  async findByReference(reference: string): Promise<TransferBatch | null> {
    return TransferBatch.query().where('reference', reference).first()
  }

  async listByAccount(accountId: string, status?: string): Promise<TransferBatch[]> {
    const query = TransferBatch.query().where('account_id', accountId)
    if (status) query.where('status', status)
    return query.orderBy('created_at', 'desc')
  }

  /**
   * Liste les lots de tous les comptes, ou d'un seul si `accountId` est fourni.
   *
   * @param {string} [status] - Filtre optionnel sur le statut.
   * @param {string} [accountId] - Restreint à un compte.
   * @returns {Promise<TransferBatch[]>} Les lots, les plus récents d'abord.
   */
  async listForAdmin(status?: string, accountId?: string): Promise<TransferBatch[]> {
    const query = TransferBatch.query()

    if (status) query.where('status', status)
    if (accountId) query.where('account_id', accountId)

    return query.orderBy('created_at', 'desc')
  }

  async update(
    batchId: number,
    patch: Partial<TransferBatch>,
    trx?: TransactionClientContract
  ): Promise<void> {
    const batch = await TransferBatch.query(trx ? { client: trx } : undefined)
      .where('id', batchId)
      .firstOrFail()

    batch.merge(patch)
    await batch.save()
  }

  async incrementSettlementCounter(
    batchId: number,
    outcome: 'success' | 'failure',
    trx: TransactionClientContract
  ): Promise<TransferBatch> {
    const column = outcome === 'success' ? 'successful_count' : 'failed_count'
    await TransferBatch.query({ client: trx }).where('id', batchId).increment(column, 1)

    const batch = await TransferBatch.query({ client: trx }).where('id', batchId).firstOrFail()
    const nextStatus = this.deriveStatus(batch)

    if (nextStatus !== batch.status) {
      await TransferBatch.query({ client: trx }).where('id', batchId).update({ status: nextStatus })
      batch.status = nextStatus
    }

    return batch
  }

  private deriveStatus(batch: TransferBatch): TransferBatchStatus {
    if (batch.successfulCount + batch.failedCount >= batch.expectedCount) {
      if (batch.failedCount === 0) return TransferBatchStatus.COMPLETED
      if (batch.successfulCount === 0) return TransferBatchStatus.FAILED
      return TransferBatchStatus.PARTIAL
    }

    return batch.status === TransferBatchStatus.QUEUED
      ? TransferBatchStatus.PROCESSING
      : batch.status
  }
}
