/**
 * Segment d'un compte — dimension qui, avec le `level`, résout ses limites (`kyc_level`).
 * Unifie KYC (particulier) et KYB (marchand / enterprise). Pour un compte org, le segment
 * reflète `OrganisationAccountType` (posé par le produit au provisioning).
 */
export enum AccountSegment {
  PARTICULIER = 'particulier',
  MARCHAND = 'marchand',
  ENTERPRISE = 'enterprise',
}
