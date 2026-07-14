/**
 * Vue publique minimale d'un utilisateur, exposée par `UserDirectoryService` aux
 * couches externes (produits) qui ont besoin d'identifier un user sans accéder à
 * son entité ni à son repository. Ne contient que le strict nécessaire ; le statut
 * KYC est réduit à un booléen (l'enum reste interne au core).
 */
export interface UserLookupResult {
  userId: string
  firstname: string | null
  lastname: string | null
  phone: string
  kycVerified: boolean
  /** Photo de profil — exposée uniquement si le KYC est vérifié (photo validée). */
  pictureUrl: string | null
}
