import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/** Où en est la vérification d'un compte, telle que son dossier la décide. */
export enum AccountVerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING_IN_REVIEW = 'PENDING_IN_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/** État d'un dossier, réduit à ce qui décide du statut. */
export interface VerificationFileState {
  status: KycDocumentStatus
}

/**
 * Rend le statut de vérification que porte un dossier.
 *
 * Un dossier en constitution vaut `NOT_STARTED`.
 *
 * @param {VerificationFileState | null} [file] - Dossier du compte, absent s'il n'a rien déposé.
 * @returns {AccountVerificationStatus} Le statut correspondant.
 */
export function statusOfFile(file?: VerificationFileState | null): AccountVerificationStatus {
  if (!file) return AccountVerificationStatus.NOT_STARTED

  switch (file.status) {
    case KycDocumentStatus.PENDING:
      return AccountVerificationStatus.PENDING_IN_REVIEW
    case KycDocumentStatus.APPROVED:
      return AccountVerificationStatus.VERIFIED
    case KycDocumentStatus.REJECTED:
      return AccountVerificationStatus.REJECTED
    default:
      return AccountVerificationStatus.NOT_STARTED
  }
}
