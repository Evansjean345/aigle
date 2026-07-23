import type { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'

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
  serviceTypeCode: string
  paymentMethodCode: string
  providerFromCode: string
  providerToCode?: string
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

/** Externe sortant : débit compte → opérateur (async). Ex. `transfert`, item de mass-transfer. */
export interface ExternalOutCommand extends MoneyCommand {
  fromAccountId: string
  destination: OperatorTarget
  type: TransactionType
  feeContext: FeeContextInput
  prefunded?: boolean
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
  /**
   * Montants monétaires résolus par l'engine (net / frais / total, unité mineure). Retournés pour
   * que le produit compose ses effets de bord (audit) SANS re-interroger le core par référence —
   * l'engine vient de les calculer. À l'extraction en service, évite un aller-retour réseau.
   */
  amount?: number
  fees?: number
  total?: number
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

// ── Settlement (Lot 3) : callback opérateur → règlement du mouvement ───────
//
// Symétrie de l'initiation : le règlement d'un mouvement externe passe par l'engine (porte unique
// de l'argent). Toute la mécanique — verrou, idempotence, mark tx/payment, crédit/refund wallet,
// ledger, classification d'erreur, events — vit dans le core ; le handler de webhook n'est qu'un
// adaptateur entrant (valide le payload, appelle `settle`, répond).

export type SettlementKind =
  | 'deposit'
  | 'transfert'
  | 'transfert_inter_first'
  | 'transfert_inter_second'

export type SettlementOutcome = 'success' | 'failure'

/** Commande de règlement d'un mouvement externe (déclenchée par le callback opérateur). */
export interface SettleCommand {
  reference: string
  kind: SettlementKind
  outcome: SettlementOutcome
  /** Réponse brute de l'opérateur (marquage payment + classification erreur CF10). */
  operatorResponse?: unknown
  error?: unknown
}

export interface SettleResult {
  reference: string
  movementId: string
  status: TransactionStatus
  /** true = mouvement déjà dans l'état terminal (rejeu idempotent), aucune mutation appliquée. */
  alreadySettled: boolean
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
  /**
   * Paramètres **opaques** spécifiques au provider (ex. `payment_mode`, `otp`, `success_url`,
   * `error_url` pour Orange/Wave). L'engine ne les interprète pas — il les transporte jusqu'à
   * `ProviderRequest.metadata` ; seul l'adaptateur du provider les déballe. Garde l'engine
   * provider-agnostic (ADR : l'engine manipule des codes, les providers leurs spécificités).
   */
  providerParams?: Record<string, unknown>
}

/** Initiation sortante : débit compte → opérateur (transfert). */
export interface ExternalOutInitiation extends ExternalInitiationBase {
  walletId: number
}

/**
 * Initiation entrante : opérateur → crédit compte (deposit).
 * La décision sync (redirect/OTP) vs async (job) appartient à la stratégie (elle connaît le
 * routage provider) — le contexte ne porte donc que les données du mouvement.
 */
export type ExternalInInitiation = ExternalInitiationBase

/** Initiation opérateur → opérateur (inter-réseau, jambe 1 cash-in). */
export interface ExternalToExternalInitiation extends ExternalInitiationBase {
  pinCode?: string
}

/**
 * Initiation de la jambe 2 d'un inter-réseau (cash-out → bénéficiaire), déclenchée après le
 * règlement de la jambe 1. `paymentId` = 2e paiement ; `totalAmount` = montant envoyé à
 * l'opérateur bénéficiaire ; `operator`/`phone` = destinataire.
 */
export type ExternalSecondLegInitiation = ExternalInitiationBase

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
