import { type AccountSegment } from '#core/identity/account/domain/enums/account_segment'

/**
 * Ligne de quota d'un compte : consommation courante, plafond, et capacité restante.
 * Un plafond `null` = **illimité** — `remaining` vaut alors `null` (pas de borne).
 */
export interface AccountQuotaLine {
  consumed: number
  limit: number | null
  remaining: number | null
}

/**
 * **Quotas** d'un compte (canal business, account-centric) — projection consommée par le marchand
 * pour afficher plafonds & consommation. Équivalent account-centric de `TransactionQuotasResult`
 * (aiglesend, user-centric) : expose `segment`/`level` du compte plutôt que le niveau KYC user, et
 * accepte des plafonds `null` (illimité) issus du standing.
 */
export interface AccountQuotasResult {
  daily: AccountQuotaLine
  monthly: AccountQuotaLine
  wallet: {
    currentBalance: number
    limit: number | null
    remainingCapacity: number | null
  }
  singleTransaction: {
    limit: number | null
  }
  segment: AccountSegment
  level: number
}
