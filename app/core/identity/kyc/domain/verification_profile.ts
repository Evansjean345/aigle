/**
 * Ce qu'un compte doit déposer pour être vérifié.
 *
 * Nomme un jeu de pièces, pas une nature de porteur : le catalogue de vérification s'indexe
 * dessus, et le core n'a donc pas à connaître les types de comptes que les produits distinguent.
 */
export enum VerificationProfile {
  /** Pièce d'identité et selfie. */
  IDENTITE = 'identite',
  /** Immatriculation de l'organisation : RCCM et DFE. */
  IMMATRICULATION = 'immatriculation',
  /** Aucune pièce : le compte n'est soumis à aucune vérification. */
  NONE = 'none',
}
