import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'

/**
 * Port de persistance du catalogue des comptes de collecte (F1).
 *
 * Aucune méthode de **suppression** : un canal se désactive (R-D6). L'absence de `delete` n'est pas
 * un oubli — c'est la contrainte rendue impossible à violer depuis le code applicatif.
 */
export default abstract class CollectionAccountRepository {
  abstract create(data: Partial<CollectionAccount>): Promise<CollectionAccount>

  abstract findByReference(reference: string): Promise<CollectionAccount | null>

  abstract findByIdentifier(accountIdentifier: string): Promise<CollectionAccount | null>

  /** Catalogue complet (admin) — actifs et inactifs, ordonnés. */
  abstract listAll(): Promise<CollectionAccount[]>

  /** Ce que voit le marchand : **uniquement les actifs**, ordonnés. */
  abstract listActive(): Promise<CollectionAccount[]>

  abstract update(account: CollectionAccount): Promise<CollectionAccount>
}
