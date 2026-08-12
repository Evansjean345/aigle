import type { KycLevelDefinition } from '#core/identity/kyc/domain/kyc_level_catalog'

/**
 * Contrats de la comparaison entre le catalogue déclaré en code et la grille en base.
 */

// ── Result (output service) ─────────────────────────────────────────

/** Palier présent en base et absent du catalogue, réduit à ce qui l'identifie. */
export interface UnknownKycLevelResult {
  segment: string
  level: number
}

/**
 * Écart entre le catalogue et la grille. Les montants n'y entrent pas.
 */
export interface KycLevelCatalogDiffResult {
  /** Déclarés au catalogue, absents de la base : aucun compte n'y résout de plafonds. */
  missing: KycLevelDefinition[]
  /** Présents en base, absents du catalogue : des comptes peuvent s'y trouver. */
  unknown: UnknownKycLevelResult[]
}
