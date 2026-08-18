import { type DateTime } from 'luxon'
import type TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'

/**
 * Volumes engagés par compte, en mémoire.
 *
 * Implémente le port : une méthode ajoutée au contrat casse la compilation ici, en un seul endroit.
 * Retient les incréments dans l'ordre, ce que les tests d'écouteurs vérifient. Les volumes ne sont
 * pas découpés par journée ni par mois : tout ce qui a été incrémenté est rendu tel quel.
 */
export default class InMemoryTransactionVolumeCache implements TransactionVolumeCache {
  /** Incréments reçus, dans l'ordre. */
  readonly increments: Array<{ accountId: string; amount: number }> = []

  private readonly volumes = new Map<string, number>()

  /**
   * Ajoute un montant au volume d'un compte.
   *
   * @param {object} params - Paramètres de l'opération.
   * @param {string} params.accountId - Compte dont le volume monte.
   * @param {number} params.amount - Montant ajouté.
   * @param {Date | string | DateTime} [params.timestamp] - Instant de l'opération, ignoré ici.
   * @returns {Promise<void>} Rien.
   */
  async incrementOnSuccess(params: {
    accountId: string
    amount: number
    timestamp?: Date | string | DateTime
  }): Promise<void> {
    this.increments.push({ accountId: params.accountId, amount: params.amount })
    this.volumes.set(params.accountId, (this.volumes.get(params.accountId) ?? 0) + params.amount)
  }

  /**
   * Rend le volume d'un compte.
   *
   * @param {string} accountId - Compte cible.
   * @returns {Promise<number>} Le volume cumulé, `0` faute d'incrément.
   */
  async getDailyVolume(accountId: string): Promise<number> {
    return this.volumes.get(accountId) ?? 0
  }

  /**
   * Rend le volume d'un compte.
   *
   * @param {string | number} accountId - Compte cible.
   * @returns {Promise<number>} Le volume cumulé, `0` faute d'incrément.
   */
  async getMonthlyVolume(accountId: string | number): Promise<number> {
    return this.volumes.get(String(accountId)) ?? 0
  }

  /**
   * Rend le volume de plusieurs comptes.
   *
   * @param {string[]} accountIds - Comptes cibles.
   * @returns {Promise<Record<string, number>>} Le volume cumulé par compte.
   */
  async getMonthlyVolumesForAccounts(accountIds: string[]): Promise<Record<string, number>> {
    return Object.fromEntries(accountIds.map((id) => [id, this.volumes.get(id) ?? 0]))
  }

  /**
   * Vide le volume d'un compte.
   *
   * @param {string} accountId - Compte cible.
   * @returns {Promise<void>} Rien.
   */
  async clearVolume(accountId: string): Promise<void> {
    this.volumes.delete(accountId)
  }
}
