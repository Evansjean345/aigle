import type { KycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Dossier d'entreprise en revue, avec le niveau que porte réellement son compte.
 *
 * Le niveau accompagne le dossier parce que la montée de palier suit l'approbation de façon
 * asynchrone : un dossier approuvé face à un compte resté au niveau bloquant signale que le report
 * n'a pas eu lieu.
 */
export interface BusinessReviewResult {
  document: KycDocumentResult
  accountLevel: number | null
  /** Vrai quand le dossier est approuvé mais que le compte n'a pas atteint son niveau. */
  levelMismatch: boolean
}

/**
 * Compteurs de la file de revue des entreprises.
 *
 * Ne comptent que les dossiers d'organisation : les pièces d'identité relèvent de l'écran KYC, qui
 * tient les siens.
 */
export interface BusinessReviewStatsResult {
  total: number
  pending: number
  inSubmission: number
  approved: number
  rejected: number
}
