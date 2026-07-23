import { inject } from '@adonisjs/core'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type {
  MassTransferBatchSummary,
  MassTransferBatchDetail,
  MassTransferItemView,
} from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Lecture des lots de mass-transfer (B9). Retourne des **DTO plats** (aucun modèle Lucid exposé au
 * produit). **Isolation par org** : le détail par référence n'est renvoyé que si le lot appartient au
 * compte (`accountId`) — un membre ne peut pas lire le lot d'une autre org en devinant la référence.
 */
@inject()
export default class TransferQueryService {
  constructor(
    private readonly batchRepo: TransferBatchRepository,
    private readonly itemRepo: TransferItemRepository
  ) {}

  async listBatches(accountId: string, status?: string): Promise<MassTransferBatchSummary[]> {
    const batches = await this.batchRepo.listByAccount(accountId, status)
    return batches.map((batch) => this.toSummary(batch))
  }

  async getBatchDetail(
    accountId: string,
    reference: string
  ): Promise<MassTransferBatchDetail | null> {
    const batch = await this.batchRepo.findByReference(reference)
    if (!batch || batch.accountId !== accountId) return null // isolation par org

    const items = await this.itemRepo.listByBatch(batch.id)
    return { ...this.toSummary(batch), items: items.map((item) => this.toItemView(item)) }
  }

  private toSummary(batch: TransferBatch): MassTransferBatchSummary {
    return {
      reference: batch.reference,
      label: batch.label,
      status: batch.status,
      totalAmount: Number(batch.totalAmount),
      fees: Number(batch.fees),
      expectedCount: batch.expectedCount,
      successfulCount: batch.successfulCount,
      failedCount: batch.failedCount,
      initiatedBy: batch.initiatedBy,
      approvedBy: batch.approvedBy,
      createdAt: batch.createdAt ? batch.createdAt.toISO() : null,
    }
  }

  private toItemView(item: TransferItem): MassTransferItemView {
    return {
      sequence: item.sequence,
      recipientName: item.recipientName,
      recipientPhone: item.recipientPhone,
      operator: item.operator,
      amount: Number(item.amount),
      status: item.status,
      failureReason: item.failureReason,
    }
  }
}
