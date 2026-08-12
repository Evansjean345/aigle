import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { type AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { type VerificationProfile } from '#core/identity/kyc/domain/verification_profile'

// ── Command (input service) ─────────────────────────────────────────

/**
 * Ouverture (idempotente) d'un compte.
 *
 * L'appelant nomme le segment et le jeu de pièces attendu ; le niveau de départ s'en déduit et
 * n'est pas fourni.
 */
export interface OpenAccountCommand {
  ownerType: AccountOwnerType
  ownerRef: string
  segment: AccountSegment
  verificationProfile: VerificationProfile
}

// ── Result (output service — read port `describe`) ──────────────────

/** Nature d'un compte : son propriétaire, son segment, son palier et son statut, sans ses limites. */
export interface AccountDescriptionResult {
  accountId: string
  ownerType: AccountOwnerType
  /** Identifiant du propriétaire dans son propre contexte : `users_uid` ou `organisation_id`. */
  ownerRef: string
  segment: AccountSegment
  /** Jeu de pièces attendu du compte. */
  verificationProfile: VerificationProfile
  /** Palier du compte. `null` sur un compte que le remplissage n'a pas atteint. */
  level: number | null
  status: AccountStatus
}

// ── Result (output service — read port `getStanding`) ───────────────

/**
 * Plafonds d'un compte pour son niveau. `null` = **illimité** (plafond ignoré à la validation).
 */
export interface AccountLimits {
  single: number | null
  daily: number | null
  monthly: number | null
  balance: number | null
}

/**
 * **Standing** d'un compte — projection minimale exposée par identity à la validation money
 * (`AccountStandingService.getStanding`). Le compte est la **source unique en lecture** : segment,
 * niveau, statut (party, synchronisé) et limites résolues via `(segment, level)`. N'expose ni le
 * modèle `Account`, ni `User`/`Organisation`.
 */
export interface AccountStandingResult {
  accountId: string
  segment: AccountSegment
  level: number
  status: AccountStatus
  limits: AccountLimits
}
