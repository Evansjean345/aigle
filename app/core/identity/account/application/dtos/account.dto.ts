import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { type AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { type AccountStatus } from '#core/identity/account/domain/enums/account_status'

// ── Command (input service) ─────────────────────────────────────────

/**
 * Ouverture (idempotente) d'un compte. Le **segment** + le **niveau** sont fournis par l'appelant
 * qui connaît la nature du propriétaire : identity (user → `particulier`) ou produit (org →
 * `marchand`/`enterprise`, produit→core par service).
 */
export interface OpenAccountCommand {
  ownerType: AccountOwnerType
  ownerRef: string
  segment: AccountSegment
  level: number
}

// ── Result (output service — read port `describe`) ──────────────────

/** Nature d'un compte : son propriétaire, son segment et son statut, sans ses limites. */
export interface AccountDescriptionResult {
  accountId: string
  ownerType: AccountOwnerType
  /** Identifiant du propriétaire dans son propre contexte : `users_uid` ou `organisation_id`. */
  ownerRef: string
  segment: AccountSegment
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
