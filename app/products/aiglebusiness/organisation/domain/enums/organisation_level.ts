/**
 * Niveau d'une organisation. Créée en LEVEL_0 (restreint : aucun mouvement
 * d'argent avant approbation du KYB). Après KYB : marchand → LEVEL_1,
 * entreprise → LEVEL_2. Source de vérité du niveau = organisation_verification
 * (sous-lot KYB).
 */
export enum OrganisationLevel {
  LEVEL_0 = 'level_0',
  LEVEL_1 = 'level_1',
  LEVEL_2 = 'level_2',
}
