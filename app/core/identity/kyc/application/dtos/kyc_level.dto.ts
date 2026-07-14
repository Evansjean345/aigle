// ── Result (output service — read port `KycLevelDirectoryService`) ──

/**
 * Limites d'un couple `(segment, level)` projetées par la feature `kyc` (propriétaire du catalogue
 * `kyc_level`) vers les consommateurs externes (ex. `identity/account`). Contrat minimal : n'expose
 * pas le modèle `KycLevel`. Plafonds `null` = **illimité**.
 */
export interface KycLevelLimitsResult {
  single: number | null
  daily: number | null
  monthly: number | null
  balance: number | null
}
