import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'

export default class TransferItemRepositoryImpl implements TransferItemRepository {
  async createMany(
    rows: Partial<TransferItem>[],
    trx?: TransactionClientContract
  ): Promise<TransferItem[]> {
    return TransferItem.createMany(rows, trx ? { client: trx } : undefined)
  }

  async findById(itemId: number, trx?: TransactionClientContract): Promise<TransferItem | null> {
    return TransferItem.query(trx ? { client: trx } : undefined)
      .where('id', itemId)
      .first()
  }

  async selectDueItemIds(limit: number, trx?: TransactionClientContract): Promise<number[]> {
    if (limit <= 0) return []
    const now = DateTime.now().toSQL({ includeOffset: false })

    const rows = await TransferItem.query(trx ? { client: trx } : undefined)
      .select('id')
      .whereIn('batch_id', (sub) => {
        sub
          .from('transfer_batches')
          .select('id')
          .whereIn('status', [TransferBatchStatus.QUEUED, TransferBatchStatus.PROCESSING])
      })
      .where('status', TransferItemStatus.QUEUED)
      .where((sub) => {
        sub.whereNull('next_retry_at').orWhere('next_retry_at', '<=', now)
      })
      .orderBy('sequence', 'asc')
      .limit(limit)

    return rows.map((row) => row.id)
  }

  async lockForSending(itemId: number, trx?: TransactionClientContract): Promise<boolean> {
    const affected = await TransferItem.query(trx ? { client: trx } : undefined)
      .where('id', itemId)
      .where('status', TransferItemStatus.QUEUED)
      .update({ status: TransferItemStatus.SENDING })

    const count = Array.isArray(affected) ? Number(affected[0] ?? 0) : Number(affected ?? 0)
    return count > 0
  }

  async update(
    itemId: number,
    patch: Partial<TransferItem>,
    trx?: TransactionClientContract
  ): Promise<void> {
    const item = await TransferItem.query(trx ? { client: trx } : undefined)
      .where('id', itemId)
      .firstOrFail()

    item.merge(patch)
    await item.save()
  }

  async findByTransactionReference(
    reference: string,
    trx?: TransactionClientContract
  ): Promise<TransferItem | null> {
    return TransferItem.query(trx ? { client: trx } : undefined)
      .where('transaction_reference', reference)
      .first()
  }

  async listByBatch(batchId: number): Promise<TransferItem[]> {
    return TransferItem.query().where('batch_id', batchId).orderBy('sequence', 'asc')
  }

  async markSettled(
    itemId: number,
    status: TransferItemStatus,
    failureReason: string | null,
    trx?: TransactionClientContract
  ): Promise<boolean> {
    const affected = await TransferItem.query(trx ? { client: trx } : undefined)
      .where('id', itemId)
      .where('status', TransferItemStatus.SENT)
      .update({
        status,
        settled_at: DateTime.now().toSQL({ includeOffset: false }),
        failure_reason: failureReason,
      })

    const count = Array.isArray(affected) ? Number(affected[0] ?? 0) : Number(affected ?? 0)
    return count > 0
  }
}
