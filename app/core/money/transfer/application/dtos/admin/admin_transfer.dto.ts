import type { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'

/**
 * DTOs admin des lots de paiement en masse.
 *
 * Canal séparé du contrat client (`dtos/transfer.dto.ts`) et non dérivé de lui : les champs ajoutés
 * ici n'atteignent pas les organisations.
 *
 * Lecture seule : aucune action n'est exposée à l'admin, l'approbation restant un contrôle interne
 * à l'organisation.
 */

// ── Result (output service) ─────────────────────────────────────────

/**
 * Bénéficiaire d'un lot, vu par l'espace admin.
 *
 * Porte en plus du contrat client les colonnes de traçabilité et de reprise du versement.
 */
export class MassTransferAdminItemResult {
  declare sequence: number
  declare recipientName: string | null
  declare recipientPhone: string
  declare operator: string
  declare amount: number
  /** Frais tarifés pour ce bénéficiaire seul, hors du montant qu'il reçoit. */
  declare fees: number
  declare currency: string
  /** Pays de destination, en ISO 2 lettres minuscules. */
  declare country: string
  declare status: string
  declare failureReason: string | null
  /** Clé de déduplication : empêche le rejeu du même versement lors d'une reprise du drain. */
  declare idempotencyKey: string
  /** Référence de la transaction Aigle générée pour ce versement. */
  declare transactionReference: string | null
  /** Référence côté opérateur : celle qu'on lui communique pour faire tracer un versement. */
  declare providerReference: string | null
  /** Nombre de tentatives d'envoi déjà consommées. */
  declare attempts: number
  /** Prochaine tentative planifiée, si le versement attend une reprise. */
  declare nextRetryAt: string | null
  /** Confirmation de l'opérateur : l'instant où l'argent est réellement arrivé. */
  declare settledAt: string | null
  declare createdAt: string | null
  declare updatedAt: string | null

  /**
   * Construit la vue admin d'un bénéficiaire depuis le modèle.
   *
   * @param {TransferItem} item - Bénéficiaire chargé depuis le repository.
   * @returns {MassTransferAdminItemResult} La vue plate destinée au back-office.
   */
  static fromItem(item: TransferItem): MassTransferAdminItemResult {
    const dto = new MassTransferAdminItemResult()
    dto.sequence = item.sequence
    dto.recipientName = item.recipientName
    dto.recipientPhone = item.recipientPhone
    dto.operator = item.operator
    dto.amount = Number(item.amount)
    dto.fees = Number(item.fees)
    dto.currency = item.currency
    dto.country = item.country
    dto.status = item.status
    dto.failureReason = item.failureReason
    dto.idempotencyKey = item.idempotencyKey
    dto.transactionReference = item.transactionReference
    dto.providerReference = item.providerReference
    dto.attempts = item.attempts
    dto.nextRetryAt = item.nextRetryAt ? item.nextRetryAt.toISO() : null
    dto.settledAt = item.settledAt ? item.settledAt.toISO() : null
    dto.createdAt = item.createdAt ? item.createdAt.toISO() : null
    dto.updatedAt = item.updatedAt ? item.updatedAt.toISO() : null

    return dto
  }
}

/**
 * Synthèse d'un lot pour l'espace admin.
 *
 * Porte `accountId`, absent du contrat client : la file admin mélange les organisations.
 */
export class MassTransferAdminBatchResult {
  declare reference: string
  /** Compte propriétaire du lot. */
  declare accountId: string
  declare label: string | null
  declare status: TransferBatchStatus
  declare totalAmount: number
  declare fees: number
  declare expectedCount: number
  declare successfulCount: number
  declare failedCount: number
  declare initiatedBy: string
  declare approvedBy: string | null
  declare createdAt: string | null

  /**
   * Construit la synthèse admin depuis le modèle.
   *
   * @param {TransferBatch} batch - Lot chargé depuis le repository.
   * @returns {MassTransferAdminBatchResult} La synthèse plate.
   */
  static fromBatch(batch: TransferBatch): MassTransferAdminBatchResult {
    const dto = new MassTransferAdminBatchResult()
    dto.reference = batch.reference
    dto.accountId = batch.accountId
    dto.label = batch.label
    dto.status = batch.status
    dto.totalAmount = Number(batch.totalAmount)
    dto.fees = Number(batch.fees)
    dto.expectedCount = batch.expectedCount
    dto.successfulCount = batch.successfulCount
    dto.failedCount = batch.failedCount
    dto.initiatedBy = batch.initiatedBy
    dto.approvedBy = batch.approvedBy
    dto.createdAt = batch.createdAt ? batch.createdAt.toISO() : null

    return dto
  }
}

/** Lot et ses bénéficiaires, pour l'espace admin. */
export class MassTransferAdminBatchDetailResult extends MassTransferAdminBatchResult {
  declare items: MassTransferAdminItemResult[]

  /**
   * Assemble le détail admin d'un lot.
   *
   * @param {TransferBatch} batch - Lot chargé depuis le repository.
   * @param {TransferItem[]} items - Bénéficiaires du lot.
   * @returns {MassTransferAdminBatchDetailResult} Le détail plat.
   */
  static fromBatchWithItems(
    batch: TransferBatch,
    items: TransferItem[]
  ): MassTransferAdminBatchDetailResult {
    const dto = Object.assign(
      new MassTransferAdminBatchDetailResult(),
      MassTransferAdminBatchResult.fromBatch(batch)
    )
    dto.items = items.map((item) => MassTransferAdminItemResult.fromItem(item))

    return dto
  }
}
