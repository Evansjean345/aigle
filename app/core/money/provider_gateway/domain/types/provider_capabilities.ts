// Airtime hors périmètre (CF11 : reste côté aiglehub) → non listé ici.
// Vocabulaire unique aligné sur les codes DB `payment_methods.code` (langage commun) :
// pas de `mobile_money`/`card`/`bank_transfer` parallèles.
export type ProviderRail = 'mobile-money' | 'bank' | 'credit-card'
export type ProviderOperation = 'checkout' | 'payout'

/**
 * Capacités déclaratives d'un provider — ce qu'il sait router.
 *
 * `operators`/`countries` absents = wildcard (tous). La sélection privilégie
 * le provider le plus restrictif (le plus ciblé) ; `priority` ne départage que
 * les ex-aequo de restrictivité.
 */
export interface ProviderCapabilities {
  rail: ProviderRail
  operations: ProviderOperation[]
  operators?: string[]
  countries?: string[]
  priority?: number
}
