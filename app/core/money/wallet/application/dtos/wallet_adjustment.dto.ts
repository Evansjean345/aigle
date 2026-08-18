import type { DateTime } from 'luxon'
import type WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#core/money/wallet/domain/enums/wallet_adjustment'

/**
 * Contrats de service des ajustements de portefeuille.
 *
 * Ce que le service reçoit et ce qu'il rend, sans modèle ORM : les consommateurs vivent hors du
 * contexte money et ne doivent pas dépendre de la persistance.
 */

// ── Command (input service) ─────────────────────────────────────────

export interface WalletAdjustmentCommand {
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  comment: string
  adminId: number
  /** Transaction rattachée. Le service la résout ; une référence inconnue est refusée. */
  transactionReference?: string
}

// ── Query (input service) ───────────────────────────────────────────

/** Filtres de la liste des ajustements, déjà normalisés par la frontière HTTP. */
export interface ListWalletAdjustmentsFilters {
  walletId?: number
  /** Compte titulaire du portefeuille ajusté. Pour une organisation, son `organisationId`. */
  accountId?: string
  adminId?: number
  type?: AdjustmentType
  reason?: AdjustmentReason
  search?: string
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
  /** Nom de tri déclaré dans `walletAdjustmentSorts`. Sans lui, l'ordre par défaut du dépôt. */
  sortBy?: string
  order?: 'asc' | 'desc'
}

// ── Result (output service) ─────────────────────────────────────────

/** Ajustement exécuté, projeté hors du contexte money. */
export interface WalletAdjustmentResult {
  adjustmentUid: string
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  balanceBefore: number
  balanceAfter: number
  transactionId: number | null
  adminId: number
  comment: string
  executedAt: DateTime
}

/**
 * Ajustement tel qu'il apparaît dans la liste, relations projetées.
 *
 * Les trois blocs rattachés — transaction, portefeuille, gestionnaire — sont nuls quand la relation
 * n'existe pas ou n'a pas été chargée : la liste reste lisible sans eux.
 */
export interface WalletAdjustmentListItemResult {
  id: number
  adjustmentUid: string
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  status: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  comment: string
  executedAt: DateTime
  createdAt: DateTime
  transaction: { id: number; reference: string } | null
  wallet: {
    id: number
    walletsUid: string
    currencySymbol?: string
    user: { usersUid: string; firstname: string; lastname: string } | null
  } | null
  admin: { id: number; firstname: string; lastname: string; email: string } | null
}

export interface WalletAdjustmentsPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedWalletAdjustmentsResult {
  data: WalletAdjustmentListItemResult[]
  meta: WalletAdjustmentsPaginationMeta
}

/** Gestionnaire rattaché à l'ajustement. La relation n'est pas déclarée sur le modèle. */
interface WalletAdjustmentAdminRelation {
  id: number
  firstname: string
  lastname: string
  email: string
}

export const toWalletAdjustmentResult = (adjustment: WalletAdjustment): WalletAdjustmentResult => ({
  adjustmentUid: adjustment.adjustmentUid,
  walletId: adjustment.walletId,
  type: adjustment.type,
  reason: adjustment.reason,
  amount: Number(adjustment.amount),
  balanceBefore: Number(adjustment.balanceBefore),
  balanceAfter: Number(adjustment.balanceAfter),
  transactionId: adjustment.transactionId,
  adminId: adjustment.adminId,
  comment: adjustment.comment,
  executedAt: adjustment.executedAt,
})

export const toWalletAdjustmentListItemResult = (
  adjustment: WalletAdjustment
): WalletAdjustmentListItemResult => {
  const admin = (adjustment as unknown as { admin?: WalletAdjustmentAdminRelation }).admin

  return {
    id: adjustment.id,
    adjustmentUid: adjustment.adjustmentUid,
    walletId: adjustment.walletId,
    type: adjustment.type,
    reason: adjustment.reason,
    status: adjustment.status,
    amount: Number(adjustment.amount),
    balanceBefore: Number(adjustment.balanceBefore),
    balanceAfter: Number(adjustment.balanceAfter),
    comment: adjustment.comment,
    executedAt: adjustment.executedAt,
    createdAt: adjustment.createdAt,
    transaction: adjustment.transaction
      ? { id: adjustment.transaction.id, reference: adjustment.transaction.reference }
      : null,
    wallet: adjustment.wallet
      ? {
          id: adjustment.wallet.id,
          walletsUid: adjustment.wallet.walletsUid,
          currencySymbol: adjustment.wallet.currencySymbol,
          user: adjustment.wallet.user
            ? {
                usersUid: adjustment.wallet.user.usersUid,
                firstname: adjustment.wallet.user.firstname,
                lastname: adjustment.wallet.user.lastname,
              }
            : null,
        }
      : null,
    admin: admin
      ? { id: admin.id, firstname: admin.firstname, lastname: admin.lastname, email: admin.email }
      : null,
  }
}
