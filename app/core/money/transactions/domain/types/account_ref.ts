/**
 * Référence minimale d'un titulaire de compte, vue par le contexte money.
 *
 * Permet aux services money de ne PAS dépendre du modèle User (contexte identity) :
 * le modèle User satisfait structurellement ce contrat (sous-typage), donc les
 * appelants qui détiennent déjà un User le passent sans conversion. C'est la
 * frontière par contrat (cf. OperationActor côté produit).
 */
export interface AccountRef {
  id: number
  usersUid: string
}
