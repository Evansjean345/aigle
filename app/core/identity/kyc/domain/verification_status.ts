import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { UserKycStatus } from '#core/identity/user/domain/enum'

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
 * @returns {UserKycStatus} Le statut correspondant.
 */
export function statusOfFile(file?: VerificationFileState | null): UserKycStatus {
  if (!file) return UserKycStatus.NOT_STARTED

  switch (file.status) {
    case KycDocumentStatus.PENDING:
      return UserKycStatus.PENDING_IN_REVIEW
    case KycDocumentStatus.APPROVED:
      return UserKycStatus.VERIFIED
    case KycDocumentStatus.REJECTED:
      return UserKycStatus.REJECTED
    default:
      return UserKycStatus.NOT_STARTED
  }
}
