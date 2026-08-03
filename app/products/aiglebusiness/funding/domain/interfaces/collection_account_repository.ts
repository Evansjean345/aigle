import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'

/**
 * Port de persistance du catalogue des comptes de collecte.
 *
 * Ne propose aucune suppression : un compte se désactive.
 */
export default abstract class CollectionAccountRepository {
  /**
   * Crée un compte de collecte.
   *
   * @param {Partial<CollectionAccount>} data - Champs du compte à persister.
   * @returns {Promise<CollectionAccount>} Le compte créé.
   */
  abstract create(data: Partial<CollectionAccount>): Promise<CollectionAccount>

  /**
   * Retrouve un compte par sa référence publique.
   *
   * @param {string} reference - Référence du compte.
   * @returns {Promise<CollectionAccount | null>} Le compte, ou `null` si la référence est inconnue.
   */
  abstract findByReference(reference: string): Promise<CollectionAccount | null>

  /**
   * Retrouve un compte par son identifiant bancaire.
   *
   * @param {string} accountIdentifier - Numéro mobile money, RIB ou IBAN.
   * @returns {Promise<CollectionAccount | null>} Le compte, ou `null` si aucun ne porte ce numéro.
   */
  abstract findByIdentifier(accountIdentifier: string): Promise<CollectionAccount | null>

  /**
   * Liste tout le catalogue, actifs et inactifs, dans l'ordre d'affichage.
   *
   * @returns {Promise<CollectionAccount[]>} Tous les comptes de collecte.
   */
  abstract listAll(): Promise<CollectionAccount[]>

  /**
   * Liste les comptes actifs, dans l'ordre d'affichage.
   *
   * @returns {Promise<CollectionAccount[]>} Les comptes proposés au marchand.
   */
  abstract listActive(): Promise<CollectionAccount[]>

  /**
   * Persiste les modifications d'un compte.
   *
   * @param {CollectionAccount} account - Compte à sauvegarder.
   * @returns {Promise<CollectionAccount>} Le compte sauvegardé.
   */
  abstract update(account: CollectionAccount): Promise<CollectionAccount>
}
