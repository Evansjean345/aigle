/**
 * Vue minimale d'un administrateur, exposée hors du core team.
 *
 * Ne porte ni rôle, ni email, ni état d'activation : les appelants externes n'affichent qu'un nom
 * d'auteur d'action. Élargir ce contrat étend la surface visible depuis les produits.
 */
export interface AdminLookupResult {
  adminId: number
  firstname: string | null
  lastname: string | null
  /** Nom d'affichage déjà assemblé, vide si l'administrateur n'a ni prénom ni nom. */
  fullName: string
}
