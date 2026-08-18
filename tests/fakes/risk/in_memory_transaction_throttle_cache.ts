import { DateTime } from 'luxon'
import type TransactionThrottleCache from '#core/money/risk/domain/interfaces/transaction_throttle_cache'
import TransferThrottleException from '#core/money/risk/infrastructure/exceptions/transfer_throttle_exception'

/**
 * Délai entre deux opérations, en mémoire.
 *
 * Implémente le port : une méthode ajoutée au contrat casse la compilation ici, en un seul endroit.
 * Retient l'ordre des horodatages, ce que les tests d'écouteurs vérifient.
 */
export default class InMemoryTransactionThrottleCache implements TransactionThrottleCache {
  /** Comptes horodatés, dans l'ordre. */
  readonly stamped: string[] = []

  private readonly lastSuccess = new Map<string, DateTime>()

  /**
   * Enregistre la date du dernier succès.
   *
   * @param {string} userId - Le compte horodaté.
   * @param {Date | string | DateTime} [timestamp] - Date du succès. Par défaut, maintenant.
   * @returns {Promise<void>} Rien.
   */
  async setLastSuccessTime(userId: string, timestamp?: Date | string | DateTime): Promise<void> {
    this.stamped.push(userId)
    this.lastSuccess.set(userId, this.toDateTime(timestamp))
  }

  /**
   * Rend la date du dernier succès.
   *
   * @param {string} userId - Le compte interrogé.
   * @returns {Promise<DateTime | null>} La date, ou `null` si le compte n'a jamais été horodaté.
   */
  async getLastSuccessTime(userId: string): Promise<DateTime | null> {
    return this.lastSuccess.get(userId) ?? null
  }

  /**
   * Refuse une opération lancée moins d'une minute après la précédente.
   *
   * @param {string} userId - Le compte qui lance l'opération.
   * @returns {Promise<void>} Rien si le délai est écoulé.
   * @throws {TransferThrottleException} Si moins d'une minute s'est écoulée.
   */
  async verifyThrottle(userId: string): Promise<void> {
    const last = this.lastSuccess.get(userId)
    if (!last) return

    if (DateTime.now().diff(last, 'seconds').seconds < 60) {
      throw new TransferThrottleException()
    }
  }

  /**
   * Ramène une date à un `DateTime`.
   *
   * @param {Date | string | DateTime} [timestamp] - La date reçue.
   * @returns {DateTime} La date, ou maintenant si aucune n'est fournie.
   */
  private toDateTime(timestamp?: Date | string | DateTime): DateTime {
    if (!timestamp) return DateTime.now()
    if (timestamp instanceof DateTime) return timestamp
    if (timestamp instanceof Date) return DateTime.fromJSDate(timestamp)

    return DateTime.fromISO(timestamp)
  }
}
