import type { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'

/**
 * DTOs du service core `transfer` (mass-transfer). Frontière **produit → core par service** : le
 * produit `aiglebusiness/transfer/mass` construit ces contrats et consomme le service core, jamais
 * ses modèles/repos (règle `produit-consomme-core-par-service`).
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

// ── Result (lecture) : synthèse de lot + détail (B9, DTO plat) ──────────

export interface MassTransferBatchSummary {
  reference: string
  label: string | null
  status: TransferBatchStatus
  totalAmount: number
  fees: number
  expectedCount: number
  successfulCount: number
  failedCount: number
  initiatedBy: string
  approvedBy: string | null
  createdAt: string | null
}

export interface MassTransferItemView {
  sequence: number
  recipientName: string | null
  recipientPhone: string
  operator: string
  amount: number
  status: string
  failureReason: string | null
}

export interface MassTransferBatchDetail extends MassTransferBatchSummary {
  items: MassTransferItemView[]
}
