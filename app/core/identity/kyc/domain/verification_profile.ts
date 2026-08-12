/**
 * Jeu de pièces attendu d'un compte, sur lequel s'indexe le catalogue de vérification.
 */
export enum VerificationProfile {
  /** Pièce d'identité et selfie. */
  IDENTITE = 'identite',
  /** Immatriculation de l'organisation : RCCM et DFE. */
  IMMATRICULATION = 'immatriculation',
  /** Aucune pièce : le compte n'est soumis à aucune vérification. */
  NONE = 'none',
}
