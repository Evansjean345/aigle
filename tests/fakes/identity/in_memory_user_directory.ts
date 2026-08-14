/**
 * Annuaire d'utilisateurs en mémoire.
 *
 * Reproduit la part de `UserDirectoryService` que lisent les services de revue — la résolution d'un
 * terme en comptes. C'est une classe concrète, pas un port : elle est passée avec un `as never` là
 * où le service est attendu, comme la doublure de standing.
 */
export default class InMemoryUserDirectory {
  /** Comptes rendus pour toute recherche. */
  accountIds: string[]

  constructor(accountIds: string[] = []) {
    this.accountIds = accountIds
  }

  async searchAccountIds(_term: string) {
    return this.accountIds
  }
}
