import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'

/** Port du repository des items (bénéficiaires) d'un lot de paiement en masse. */
export default abstract class TransferItemRepository {
  /** Insertion en masse des items d'un lot (bulk-insert, L2 D2). */
  abstract createMany(
    rows: Partial<TransferItem>[],
    trx?: TransactionClientContract
  ): Promise<TransferItem[]>

  /** Charge un item par id. */
  abstract findById(itemId: number, trx?: TransactionClientContract): Promise<TransferItem | null>

  /**
   * Sélectionne les ids des items **dus** pour le relais : lot en `queued`/`processing` ET item
   * `queued` OU dont le `next_retry_at` est échu. Ordonné par `sequence`, plafonné à `limit`.
   */
  abstract selectDueItemIds(limit: number, trx?: TransactionClientContract): Promise<number[]>

  /**
   * Verrou idempotent d'exécution : bascule `queued → sending` **de façon gardée** (UPDATE WHERE
   * status='queued'). Retourne `true` si CE process a pris l'item, `false` si un autre l'a déjà pris
   * ou s'il n'est plus `queued` (terminal). Anti double-envoi multi-worker.
   */
  abstract lockForSending(itemId: number, trx?: TransactionClientContract): Promise<boolean>

  /** Met à jour un item (transition d'état, refs provider/transaction, retry). */
  abstract update(
    itemId: number,
    patch: Partial<TransferItem>,
    trx?: TransactionClientContract
  ): Promise<void>

  /** Retrouve un item par la référence de sa transaction core (settlement). */
  abstract findByTransactionReference(
    reference: string,
    trx?: TransactionClientContract
  ): Promise<TransferItem | null>

  /** Liste les items d'un lot, ordonnés par `sequence` (lecture / détail). */
  abstract listByBatch(batchId: number): Promise<TransferItem[]>

  /**
   * Règle un item **de façon gardée** (`WHERE status='sent'`) : bascule vers `succeeded`/`failed` +
   * `settled_at`. Retourne `true` si CE settlement a effectué la transition (premier passage), `false`
   * si l'item était déjà réglé (rejeu) → anti double-comptage des compteurs du lot.
   */
  abstract markSettled(
    itemId: number,
    status: TransferItemStatus,
    failureReason: string | null,
    trx?: TransactionClientContract
  ): Promise<boolean>
}
