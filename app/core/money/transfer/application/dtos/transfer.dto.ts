import type { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'

/**
 * DTOs du service core `transfer` (mass-transfer). Le produit construit ces contrats et consomme le
 * service core, jamais ses modèles ni ses repositories.
 *
 * Canal client : ce qu'une organisation lit sur ses propres lots. L'espace admin a ses
 * propres contrats dans `dtos/admin/admin_transfer.dto.ts` — les deux ne se dérivent pas l'un de
 * l'autre.
 */

// ── Command (input service) ─────────────────────────────────────────

/** Un bénéficiaire d'un lot (déjà structuré par le produit — le core ne parse aucun fichier). */
export interface MassTransferRecipient {
  amount: number
  phone: string
  operator: string
  name?: string
  country?: string
}

/** Intention d'initier un lot de paiement en masse (usecase produit → service core). */
export interface InitiateMassTransferCommand {
  /** Compte source (org) — account-centric. */
  accountId: string
  /** User (membre) initiateur — traçabilité. */
  initiatedBy: string
  label?: string
  description?: string
  /** Clé d'idempotence de requête (rejeu du POST → même lot). */
  idempotencyKey?: string
  recipients: MassTransferRecipient[]
}

// ── Result (output service) ─────────────────────────────────────────

/** Résultat d'initiation d'un lot (plat — aucun modèle Lucid n'est exposé au produit). */
export interface MassTransferResult {
  reference: string
  status: TransferBatchStatus
  expectedCount: number
  totalAmount: number
  fees: number
  /** true = rejeu idempotent (lot déjà existant, rien réservé ni inséré). */
  alreadyExisted: boolean
}

// ── Result (lecture) : synthèse de lot + détail ─────────────────────

/**
 * Synthèse d'un lot pour l'organisation qui l'a initié.
 *
 * Ne porte pas `accountId` : le lecteur est le propriétaire du lot. Ce champ n'existe que dans la
 * vue admin.
 */
export class MassTransferBatchResult {
  declare reference: string
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
   * Construit la synthèse depuis le modèle.
   *
   * @param {TransferBatch} batch - Lot chargé depuis le repository.
   * @returns {MassTransferBatchResult} La synthèse plate destinée au produit.
   */
  static fromBatch(batch: TransferBatch): MassTransferBatchResult {
    const dto = new MassTransferBatchResult()
    dto.reference = batch.reference
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

/** Bénéficiaire d'un lot, tel que le voit l'organisation propriétaire. */
export class MassTransferItemResult {
  declare sequence: number
  declare recipientName: string | null
  declare recipientPhone: string
  declare operator: string
  declare amount: number
  declare fees: number
  declare status: string
  declare failureReason: string | null

  /**
   * Construit la vue d'un bénéficiaire depuis le modèle.
   *
   * @param {TransferItem} item - Bénéficiaire chargé depuis le repository.
   * @returns {MassTransferItemResult} La vue plate.
   */
  static fromItem(item: TransferItem): MassTransferItemResult {
    const dto = new MassTransferItemResult()
    dto.sequence = item.sequence
    dto.recipientName = item.recipientName
    dto.recipientPhone = item.recipientPhone
    dto.operator = item.operator
    dto.amount = Number(item.amount)
    dto.fees = Number(item.fees)
    dto.status = item.status
    dto.failureReason = item.failureReason

    return dto
  }
}

/** Lot et ses bénéficiaires, pour l'organisation propriétaire. */
export class MassTransferBatchDetailResult extends MassTransferBatchResult {
  declare items: MassTransferItemResult[]

  /**
   * Assemble le détail d'un lot.
   *
   * @param {TransferBatch} batch - Lot chargé depuis le repository.
   * @param {TransferItem[]} items - Bénéficiaires du lot.
   * @returns {MassTransferBatchDetailResult} Le détail plat.
   */
  static fromBatchWithItems(
    batch: TransferBatch,
    items: TransferItem[]
  ): MassTransferBatchDetailResult {
    const dto = Object.assign(
      new MassTransferBatchDetailResult(),
      MassTransferBatchResult.fromBatch(batch)
    )
    dto.items = items.map((item) => MassTransferItemResult.fromItem(item))

    return dto
  }
}

/**
 * Devis d'un lot avant initiation : ce que ça coûte et ce qu'il manque.
 *
 * Photo instantanée, pas une réservation : le solde peut bouger d'ici à l'initiation, qui reste seule
 * juge.
 */
export interface MassTransferSimulationResult {
  expectedCount: number
  currency: string
  /** Σ des montants envoyés aux bénéficiaires. */
  totalAmount: number
  /** Σ des frais, tarifés par bénéficiaire. */
  fees: number
  /** Ce qui sera réservé : `totalAmount + fees`. */
  total: number
  balance: number
  /** `max(0, total − balance)`. */
  shortfall: number
}
