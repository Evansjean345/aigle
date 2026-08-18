import type TransactionFailureCache from '#core/money/risk/domain/interfaces/transaction_failure_cache'

/**
 * Compteur d'échecs consécutifs, en mémoire.
 *
 * Implémente le port : une méthode ajoutée au contrat casse la compilation ici, en un seul endroit.
 * Compte et efface, sans reproduire les paliers de blocage — `verifyNotBlocked` ne refuse jamais.
 */
export default class InMemoryTransactionFailureCache implements TransactionFailureCache {
  /** Comptes dont le compteur a été effacé, dans l'ordre. */
  readonly cleared: string[] = []

  private readonly failures = new Map<string, number>()

  /**
   * Incrémente le compteur d'échecs d'un compte.
   *
   * @param {string} userId - Le compte en échec.
   * @returns {Promise<void>} Rien.
   */
  async incrementFailure(userId: string): Promise<void> {
    this.failures.set(userId, (this.failures.get(userId) ?? 0) + 1)
  }

  /**
   * Laisse toujours passer.
   *
   * @returns {Promise<void>} Rien : les paliers de blocage ne sont pas reproduits ici.
   */
  async verifyNotBlocked(): Promise<void> {}

  /**
   * Efface le compteur d'échecs d'un compte.
   *
   * @param {string} userId - Le compte remis à zéro.
   * @returns {Promise<void>} Rien.
   */
  async resetFailures(userId: string): Promise<void> {
    this.cleared.push(userId)
    this.failures.delete(userId)
  }

  /**
   * Rend le nombre d'échecs consécutifs d'un compte.
   *
   * @param {string} userId - Le compte interrogé.
   * @returns {number} Le compteur, `0` si le compte n'a jamais échoué.
   */
  countFor(userId: string): number {
    return this.failures.get(userId) ?? 0
  }
}
