import { type DateTime } from 'luxon'

/**
 * Volumes engagés par un **compte**, sur la journée et sur le mois.
 *
 * La clé Redis conserve son préfixe `tx:vol:user:` : le renommer perdrait les volumes en cours.
 */
export default abstract class TransactionVolumeCache {
  /**
   * Incrémente le volume d'un compte, sur la journée et sur le mois.
   *
   * @param {Object} params - Paramètres de l'opération.
   * @param {string} params.accountId - Compte dont le volume est incrémenté.
   * @param {number} params.amount - Montant à ajouter.
   * @param {Date|string|DateTime} [params.timestamp] - Instant de l'opération, maintenant par défaut.
   * @return {Promise<void>} Résolue quand l'incrément est écrit.
   */
  abstract incrementOnSuccess(params: {
    accountId: string
    amount: number
    timestamp?: Date | string | DateTime
  }): Promise<void>

  /**
   * Rend le volume engagé par un compte sur une journée.
   *
   * @param {string} accountId - Compte cible.
   * @param {Date | string | DateTime} [dt] - Journée visée, aujourd'hui par défaut.
   * @return {Promise<number>} Le volume de la journée.
   */
  abstract getDailyVolume(accountId: string, dt?: Date | string | DateTime): Promise<number>

  /**
   * Rend le volume engagé par un compte sur un mois.
   *
   * @param {string | number} accountId - Compte cible.
   * @param {Date | string | DateTime} [dt] - Mois visé, le mois courant par défaut.
   * @return {Promise<number>} Le volume du mois, `0` faute de donnée.
   */
  abstract getMonthlyVolume(
    accountId: string | number,
    dt?: Date | string | DateTime
  ): Promise<number>

  /**
   * Rend le volume mensuel de plusieurs comptes.
   *
   * @param {string[]} accountIds - Comptes cibles.
   * @param {Date | string | DateTime} [dt] - Mois visé.
   * @returns {Promise<Record<string, number>>} Le volume du mois par compte.
   */
  abstract getMonthlyVolumesForAccounts(
    accountIds: string[],
    dt?: Date | string | DateTime
  ): Promise<Record<string, number>>

  /**
   * Vide les volumes d'un compte, journalier et mensuel.
   *
   * @param {string} accountId - Compte cible.
   * @return {Promise<void>} Résolue quand les clés sont supprimées.
   */
  abstract clearVolume(accountId: string): Promise<void>
}
