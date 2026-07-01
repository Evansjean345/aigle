import type { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import type { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

/**
 * Types du contrat MoneyMovementEngine (core).
 * Réf. doc centrale §5.1 « MoneyMovementEngine ».
 *
 * Invariants :
 * - Montants en **entiers, unité mineure** (jamais de float).
 * - Toute commande porte une **clé d'idempotence** obligatoire (anti double-mouvement).
 *
 * Réutilise la taxonomie EXISTANTE (`TransactionType`, `TransactionStatus`) plutôt que
 * d'en inventer une parallèle. Le mécanisme (interne / externe-out / externe-in / reverse)
 * est déjà porté par la MÉTHODE de l'engine ; `type` ne sert qu'au reporting métier. Les
 * types business (payout, collect…) seront AJOUTÉS à `TransactionType`, pas dupliqués ici.
 */

/** Destinataire/source côté opérateur (mobile money). */
export interface OperatorTarget {
  operator: string
  msisdn: string
  country: string
}

/** Base commune à toutes les commandes. */
export interface MoneyCommand {
  /** Obligatoire — déduplication (ex. `batch_id + item_id`). */
  idempotencyKey: string
  /** Entiers, unité mineure. */
  amount: number
  currency: string
  /** user_id — audit (qui a initié). */
  initiatedBy: stringZ
  /** Corrélation métier optionnelle. */
  reference?: string
  metadata?: Record<string, unknown>
}

/** Interne : compte → compte (atomique, synchrone). */
export interface InternalMoveCommand extends MoneyCommand {
  fromAccountId: string
  toAccountId: string
  type: TransactionType
}

/** Externe sortant : débit compte → opérateur (async). Ex. `transfert`, futur payout. */
export interface ExternalOutCommand extends MoneyCommand {
  fromAccountId: string
  destination: OperatorTarget
  type: TransactionType
}

/** Externe entrant : opérateur → crédit compte (async). Ex. `deposit`, futur collect. */
export interface ExternalInCommand extends MoneyCommand {
  toAccountId: string
  source: OperatorTarget
  type: TransactionType
}

/**
 * Externe → externe : débit numéro source (opérateur A) → crédit numéro dest (opérateur B),
 * Aigle en pont. L'engine orchestre la saga cash-in + cash-out + compensation. Ex. `inter_reseau`.
 */
export interface ExternalToExternalCommand extends MoneyCommand {
  source: OperatorTarget
  destination: OperatorTarget
  type: TransactionType
}

/** Contre-passation (refund) d'un mouvement existant. */
export interface ReverseCommand extends MoneyCommand {
  originalReference: string
  reason: string
}

/**
 * Résultat d'un mouvement.
 * Interne → `success` (synchrone) ; externe → `pending` puis event de settlement.
 */
export interface MovementResult {
  status: TransactionStatus
  movementId: string
  reference: string
  providerReference?: string
  ledgerEntryIds?: string[]
  failureReason?: string
}
