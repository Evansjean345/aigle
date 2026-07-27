import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'

/**
 * Suivi du settlement d'un lot (B5, L2-D14). Le **core `settle`** fait l'argent (transaction
 * SUCCESS, ou FAILED + refund = release) ; **ici** on fait le suivi : marquer l'item réglé, incrémenter
 * les compteurs du lot **atomiquement** (`FOR UPDATE`), et **agréger** le statut du lot quand tous les
 * items sont terminés (`completed`/`partial`/`failed`).
 *
 * Générique côté core : appelé par un listener abonné aux events `TransfertTransactionCompleted/Failed`.
 * Une référence de transaction qui n'appartient à aucun item (transfert consumer/unique) est ignorée.
 * Idempotent : `markSettled` est gardé (`WHERE status='sent'`) → un rejeu ne re-compte jamais.
 */
@inject()
export default class TransferSettlementService {
  constructor(
    private readonly itemRepo: TransferItemRepository,
    private readonly batchRepo: TransferBatchRepository
  ) {}

  async applyItemSettlement(
    transactionReference: string,
    outcome: 'success' | 'failure'
  ): Promise<void> {
    const item = await this.itemRepo.findByTransactionReference(transactionReference)
    if (!item) return // pas un item de mass (transfert consumer/unique) → ignore

    const trx = await db.transaction()
    try {
      const status =
        outcome === 'success' ? TransferItemStatus.SUCCEEDED : TransferItemStatus.FAILED
      const failureReason = outcome === 'failure' ? 'settlement failed' : null

      const settled = await this.itemRepo.markSettled(item.id, status, failureReason, trx)
      // `incrementSettlementCounter` incrémente le compteur ET dérive/agrège le statut du lot (centralisé).
      if (settled) {
        await this.batchRepo.incrementSettlementCounter(item.batchId, outcome, trx)
      }

      await trx.commit()
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }
}
