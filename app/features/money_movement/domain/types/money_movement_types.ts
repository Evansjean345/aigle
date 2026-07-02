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

/**
 * Contexte de frais — IDs catalogue product-agnostic (aucune string codée en dur côté core).
 * Le produit choisit le service/moyen/provider ; l'engine calcule les frais via le service
 * core `fees` (L2-D6 : les frais appartiennent à l'engine).
 */
export interface FeeContextInput {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number
  /** Le montant inclut-il déjà les frais (gross-up) ? */
  includeFees?: boolean
}

/** Base commune à toutes les commandes. */
export interface MoneyCommand {
  /** Obligatoire — déduplication (ex. `batch_id + item_id`). */
  idempotencyKey: string
  /** Entiers, unité mineure. */
  amount: number
  currency: string
  /** user_id — audit (qui a initié). */
  initiatedBy: string
  /** Corrélation métier optionnelle. */
  reference?: string
  metadata?: Record<string, unknown>
}

/** Interne : compte → compte (atomique, synchrone). */
export interface InternalMoveCommand extends MoneyCommand {
  fromAccountId: string
  toAccountId: string
  type: TransactionType
  feeContext: FeeContextInput
}

/** Externe sortant : débit compte → opérateur (async). Ex. `transfert`, futur payout. */
export interface ExternalOutCommand extends MoneyCommand {
  fromAccountId: string
  destination: OperatorTarget
  type: TransactionType
  feeContext: FeeContextInput
}

/** Externe entrant : opérateur → crédit compte (async). Ex. `deposit`, futur collect. */
export interface ExternalInCommand extends MoneyCommand {
  toAccountId: string
  source: OperatorTarget
  type: TransactionType
  feeContext: FeeContextInput
}

/**
 * Externe → externe : débit numéro source (opérateur A) → crédit numéro dest (opérateur B),
 * Aigle en pont. L'engine orchestre la saga cash-in + cash-out + compensation. Ex. `inter_reseau`.
 */
export interface ExternalToExternalCommand extends MoneyCommand {
  source: OperatorTarget
  destination: OperatorTarget
  type: TransactionType
  feeContext: FeeContextInput
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
  /**
   * Données de retour du provider à propager au produit (ex. URL de redirection /
   * OTP d'un checkout synchrone). Optionnel — présent uniquement quand l'initiation
   * externe est synchrone et retourne des éléments d'interaction utilisateur.
   */
  providerData?: Record<string, unknown>
  /**
   * Références des records satellites créés par le mouvement (ex. la transaction miroir
   * de crédit d'un transfert interne). Permet au produit de retrouver ces records pour
   * ses propres effets de bord (notification, audit) sans que le contrat n'expose de modèle.
   */
  relatedReferences?: string[]
}

// ── Events de settlement (types définis au Lot 2 ; émission au Lot 3) ──────

/**
 * Émis quand un mouvement externe est confirmé réglé (callback opérateur).
 * Le produit **écoute** pour finaliser (notifications, statut applicatif) — il ne bloque pas.
 */
export interface MovementSettled {
  movementId: string
  reference: string
  status: TransactionStatus
  providerReference?: string
  /** ISO-8601. */
  settledAt: string
}

/**
 * Émis quand un mouvement externe échoue définitivement (callback opérateur / classification).
 */
export interface MovementFailed {
  movementId: string
  reference: string
  reason: string
  /** ISO-8601. */
  failedAt: string
}

// ── Port stratégie externe (initiation) ───────────────────────────────────
//
// L'engine possède la trx DB (L2-D5) puis délègue l'INITIATION externe à une stratégie
// (http = jobs/sync_checkout existants au Lot 2 ; local = provider_gateway, activée au 3b).
// Les contextes ne véhiculent QUE des identifiants et données métier — jamais de contexte
// transactionnel (pas de trx). Ils dérivent des payloads réels des jobs actuels.

/** Base commune aux initiations externes. */
export interface ExternalInitiationBase {
  transactionId: number
  transactionReference: string
  paymentId: number
  amount: number
  totalAmount: number
  fees: number
  /** Code opérateur/provider (ex. `orange`, `moov`). */
  operator: string
  /** Code du moyen de paiement (ex. `mobile-money`). */
  paymentMethod: string
  phone: string
  userId: string
}

/** Initiation sortante : débit compte → opérateur (transfert). */
export interface ExternalOutInitiation extends ExternalInitiationBase {
  walletId: number
}

/** Initiation entrante : opérateur → crédit compte (deposit). */
export interface ExternalInInitiation extends ExternalInitiationBase {
  /** Le provider résout-il de façon synchrone (redirect/OTP) plutôt que par job async ? */
  sync: boolean
  /** OTP fourni (Orange) à transmettre au provider. */
  otp?: string
}

/** Initiation opérateur → opérateur (inter-réseau, jambe 1 cash-in). */
export interface ExternalToExternalInitiation extends ExternalInitiationBase {
  pinCode?: string
}

/**
 * Résultat d'une initiation externe.
 * `PENDING` (async / attente webhook) ; `providerData` porte les éléments d'interaction
 * synchrones (redirect URL, type) le cas échéant.
 */
export interface ExternalInitiationResult {
  status: TransactionStatus
  providerReference?: string
  providerData?: Record<string, unknown>
}
