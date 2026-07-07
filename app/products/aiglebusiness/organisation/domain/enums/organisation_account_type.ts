/**
 * Nature d'une organisation business.
 * - MARCHAND : mono-user, KYB par photo du lieu → LEVEL_1 après approbation.
 * - ENTERPRISE : multi-membres, KYB par RCCM/DFE → LEVEL_2 après approbation.
 */
export enum OrganisationAccountType {
  MARCHAND = 'marchand',
  ENTERPRISE = 'enterprise',
}
