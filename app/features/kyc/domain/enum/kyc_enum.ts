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

export enum KycDocumentNextAction {
  DOCUMENT = 'DOCUMENT',
  SELFIE = 'SELFIE',
  IN_REVIEW = 'IN_REVIEW',
}
