export enum KycDocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_SUBMISSION = 'in_submission',
}

export enum KycDocumentType {
  CNI = 'CNI',
  PASSPORT = 'PASSPORT',
  PERMIT_CONDUIT = 'PERMIS_CONDUIT',
}

export enum KycLevelState {
  NOT_VERIFY = 1,
  KYC_VERIFIED = 2,
}

/**
 * Rôle d'une pièce dans un dossier de vérification.
 *
 * `RECTO`, `VERSO` et `SELFIE` composent un dossier d'identité ; le dossier d'organisation reçoit
 * ses propres rôles.
 */
export enum DocumentPieceType {
  RECTO = 'RECTO',
  VERSO = 'VERSO',
  SELFIE = 'SELFIE',
  RCCM = 'RCCM',
  DFE = 'DFE',
}

export enum KycDocumentNextAction {
  DOCUMENT = 'DOCUMENT',
  SELFIE = 'SELFIE',
  IN_REVIEW = 'IN_REVIEW',
}
