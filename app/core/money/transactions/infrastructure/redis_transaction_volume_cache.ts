import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'
import type TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'

/**
 * A class that provides caching mechanisms for tracking and retrieving transaction volumes
 * for users, using Redis as the underlying datastore. This includes functionality to handle
 * daily and monthly transaction volumes and mark transactions as processed.
 *
 * This class implements the `TransactionVolumeCache` interface, providing methods to interact
 * with cached transaction data for various time frames and ensuring proper time-to-live (TTL)
 * management for keys.
 */
export default class RedisTransactionVolumeCache implements TransactionVolumeCache {
  private readonly connection = redis.connection('transactions')
  private static ZONE = 'UTC'

  /**
   * Normalizes a given timestamp to a DateTime object with the specified time zone.
   *
   * @param {Date | string | DateTime} [ts] - The timestamp to normalize. Can be a JavaScript Date object, an ISO 8601 string, or a DateTime object. If not provided, the current DateTime is used.
   * @return {DateTime<boolean>} A DateTime object representing the normalized timestamp in the specified time zone.
   */
  private static normalize(ts?: Date | string | DateTime): DateTime<boolean> {
    if (!ts) return DateTime.now().setZone(this.ZONE)
    if (ts instanceof Date) return DateTime.fromJSDate(ts).setZone(this.ZONE)
    if (ts instanceof DateTime) return ts.setZone(this.ZONE)

    return DateTime.fromISO(ts).setZone(this.ZONE)
  }

  /**
   * Compose la clé du volume journalier d'un compte.
   *
   * Le segment `user:` est conservé : le changer perdrait les volumes en cours.
   *
   * @param {string} accountId - Compte cible.
   * @param {DateTime<boolean>} dt - Journée visée.
   * @return {string} La clé Redis.
   */
  private dayKey(accountId: string, dt: DateTime<boolean>): string {
    return `tx:vol:user:${accountId}:day:${dt.toFormat('yyyyLLdd')}` // 20251217
  }

  /**
   * Compose la clé du volume mensuel d'un compte.
   *
   * @param {string | number} accountId - Compte cible.
   * @param {DateTime} dt - Mois visé.
   * @return {string} La clé Redis.
   */
  private monthKey(accountId: string | number, dt: DateTime): string {
    return `tx:vol:user:${accountId}:month:${dt.toFormat('yyyyLL')}` // 202512
  }

  /**
   * Calculates the time-to-live (TTL) in seconds between the current time and a specified target time.
   *
   * @param {DateTime} now - The current time.
   * @param {DateTime} to - The target time for which to calculate the TTL.
   * @return {number} The TTL in seconds, rounded up to the nearest whole number. A minimum value of 1 is always returned.
   */
  private static ttlSeconds(now: DateTime, to: DateTime): number {
    const seconds = to.diff(now, 'seconds').seconds
    return Math.max(1, Math.ceil(seconds))
  }

  /**
   * Incrémente le volume d'un compte, sur la journée et sur le mois.
   *
   * @param {Object} params - Paramètres de l'opération.
   * @param {string} params.accountId - Compte dont le volume est incrémenté.
   * @param {number} params.amount - Montant à ajouter.
   * @param {Date|string|DateTime} [params.timestamp] - Instant de l'opération, maintenant par défaut.
   * @return {Promise<void>} Résolue quand l'incrément est écrit.
   */
  async incrementOnSuccess(params: {
    accountId: string
    amount: number
    timestamp?: Date | string | DateTime
  }): Promise<void> {
    const { accountId, amount } = params

    const ts = RedisTransactionVolumeCache.normalize(params.timestamp)
    const now = DateTime.now().setZone(RedisTransactionVolumeCache.ZONE)

    const keys = [
      {
        key: this.dayKey(accountId, ts),
        ttl: RedisTransactionVolumeCache.ttlSeconds(now, ts.endOf('day')),
      },
      {
        key: this.monthKey(accountId, ts),
        ttl: RedisTransactionVolumeCache.ttlSeconds(now, ts.endOf('month')),
      },
    ]

    for (const { key, ttl } of keys) {
      await this.connection.incrbyfloat(key, amount)
      const currentTTL = await this.connection.ttl(key)

      if (currentTTL < 0) {
        await this.connection.expire(key, ttl)
      }
    }
  }

  /**
   * Rend le volume engagé par un compte sur une journée.
   *
   * @param {string} accountId - Compte cible.
   * @param {Date | string | DateTime} [dt] - Journée visée, aujourd'hui par défaut.
   * @return {Promise<number>} Le volume de la journée.
   */
  async getDailyVolume(accountId: string, dt?: Date | string | DateTime): Promise<number> {
    const key = this.dayKey(accountId, RedisTransactionVolumeCache.normalize(dt))
    const val = await this.connection.get(key)
    return val ? Number(val) : 0
  }

  /**
   * Rend le volume engagé par un compte sur un mois.
   *
   * @param {string | number} accountId - Compte cible.
   * @param {Date | string | DateTime} [dt] - Mois visé, le mois courant par défaut.
   * @return {Promise<number>} Le volume du mois, `0` faute de donnée.
   */
  async getMonthlyVolume(
    accountId: string | number,
    dt?: Date | string | DateTime
  ): Promise<number> {
    const key = this.monthKey(accountId, RedisTransactionVolumeCache.normalize(dt))
    const val = await this.connection.get(key)
    return val ? Number(val) : 0
  }

  /**
   * Rend le volume mensuel de plusieurs comptes.
   *
   * @param {string[]} accountIds - Comptes cibles.
   * @param {Date | string | DateTime} [dt] - Mois visé.
   * @returns {Promise<Record<string, number>>} Le volume du mois par compte.
   */
  async getMonthlyVolumesForAccounts(
    accountIds: string[],
    dt?: Date | string | DateTime
  ): Promise<Record<string, number>> {
    const ts = RedisTransactionVolumeCache.normalize(dt)
    const pipeline = this.connection.pipeline()

    accountIds.forEach((accountId) => {
      pipeline.get(this.monthKey(accountId, ts))
    })

    const results = await pipeline.exec()
    const volumes: Record<string, number> = {}

    accountIds.forEach((accountId, index) => {
      const val = results ? results[index] : null
      volumes[accountId] =
        val && Array.isArray(val) ? (val[1] ? Number(val[1]) : 0) : val ? Number(val) : 0
    })

    return volumes
  }

  /**
   * Vide les volumes d'un compte, journalier et mensuel.
   *
   * @param {string} accountId - Compte cible.
   * @return {Promise<void>} Résolue quand les clés sont supprimées.
   */
  async clearVolume(accountId: string): Promise<void> {
    const pattern = `tx:vol:user:${accountId}:*`
    const keys = await this.connection.keys(pattern)

    if (keys.length > 0) {
      await this.connection.del(...keys)
    }
  }
}
