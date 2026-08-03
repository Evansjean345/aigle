import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'

/** Port du repository des lots de paiement en masse. */
export default abstract class TransferBatchRepository {
  /** Crée un lot. */
  abstract create(
    data: Partial<TransferBatch>,
    trx?: TransactionClientContract
  ): Promise<TransferBatch>

  /** Charge un lot par id. */
  abstract findById(batchId: number, trx?: TransactionClientContract): Promise<TransferBatch | null>

  /** Charge un lot par sa référence publique, **verrouillé** (`FOR UPDATE`) — pour approve/reject. */
  abstract findByReferenceForUpdate(
    reference: string,
    trx: TransactionClientContract
  ): Promise<TransferBatch | null>

  /** Charge un lot par sa référence publique (lecture). */
  abstract findByReference(reference: string): Promise<TransferBatch | null>

  /** Liste les lots d'un compte (org), filtrable par statut, plus récents d'abord (lecture). */
  abstract listByAccount(accountId: string, status?: string): Promise<TransferBatch[]>

  /**
   * Liste les lots de **tous** les comptes, pour l'espace admin.
   *
   * ⚠️ Sans cloisonnement par compte, contrairement à `listByAccount` : à réserver aux contrôleurs
   * admin. Un usage depuis un contrôleur client serait une fuite inter-organisations.
   *
   * @param {string} [status] - Filtre optionnel sur le statut du lot.
   * @param {string} [accountId] - Restreint à un compte, pour la vue par organisation.
   * @returns {Promise<TransferBatch[]>} Les lots correspondants, les plus récents d'abord.
   */
  abstract listForAdmin(status?: string, accountId?: string): Promise<TransferBatch[]>

  /** Retrouve un lot par sa clé d'idempotence de requête (rejeu du POST → même lot). */
  abstract findByIdempotencyKey(
    key: string,
    trx?: TransactionClientContract
  ): Promise<TransferBatch | null>

  /** Met à jour un lot (transition d'état, agrégation). */
  abstract update(
    batchId: number,
    patch: Partial<TransferBatch>,
    trx?: TransactionClientContract
  ): Promise<void>

  /**
   * Incrémente **atomiquement** (verrou `FOR UPDATE`) le compteur du lot selon l'issue d'un item
   * réglé (`successful_count`/`failed_count`), passe le lot en `processing` s'il était `queued`, et
   * retourne le lot rechargé (pour dériver l'agrégat quand tous les items sont terminés).
   */
  abstract incrementSettlementCounter(
    batchId: number,
    outcome: 'success' | 'failure',
    trx: TransactionClientContract
  ): Promise<TransferBatch>
}
