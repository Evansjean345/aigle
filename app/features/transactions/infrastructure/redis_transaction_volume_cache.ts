import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'

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
   * Generates a unique key string for a specific user and date.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {DateTime<boolean>} dt - The date object representing the target day.
   * @return {string} A formatted string key combining the user ID and date.
   */
  private dayKey(userId: string, dt: DateTime<boolean>): string {
    return `tx:vol:user:${userId}:day:${dt.toFormat('yyyyLLdd')}` // 20251217
  }

  /**
   * Generates a unique key string based on the user ID and the month of the provided DateTime object.
   *
   * @param {string | number} userId - The identifier for the user, can be a string or a number.
   * @param {DateTime} dt - The DateTime object representing the date to extract the month and year.
   * @return {string} A formatted string key containing the user ID and the month-year in 'yyyyLL' format.
   */
  private monthKey(userId: string | number, dt: DateTime): string {
    return `tx:vol:user:${userId}:month:${dt.toFormat('yyyyLL')}` // 202512
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
   * Increments the transaction volume for a user in a cache on success. Updates cache keys for both daily and monthly tracking.
   *
   * @param {Object} params - The parameters for the operation.
   * @param {string} params.userId - The unique identifier for the user whose volume is being incremented.
   * @param {number} params.amount - The amount to increment the transaction volume by.
   * @param {Date|string|DateTime} [params.timestamp] - The timestamp associated with the operation. Defaults to the current time if not provided.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  async incrementOnSuccess(params: {
    userId: string
    amount: number
    timestamp?: Date | string | DateTime
  }): Promise<void> {
    const { userId, amount } = params

    const ts = RedisTransactionVolumeCache.normalize(params.timestamp)
    const now = DateTime.now().setZone(RedisTransactionVolumeCache.ZONE)

    const keys = [
      {
        key: this.dayKey(userId, ts),
        ttl: RedisTransactionVolumeCache.ttlSeconds(now, ts.endOf('day')),
      },
      {
        key: this.monthKey(userId, ts),
        ttl: RedisTransactionVolumeCache.ttlSeconds(now, ts.endOf('month')),
      },
    ]

    for (const { key, ttl } of keys) {
      await redis.incrbyfloat(key, amount)
      const currentTTL = await redis.ttl(key)

      if (currentTTL < 0) {
        await redis.expire(key, ttl)
      }
    }
  }

  /**
   * Retrieves the daily transaction volume for a specific user based on the given date.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {Date | string | DateTime} [dt] - The date for which the daily volume is to be retrieved. If not provided, defaults to the current date.
   * @return {Promise<number>} A promise that resolves to the daily transaction volume as a number.
   */
  async getDailyVolume(userId: string, dt?: Date | string | DateTime): Promise<number> {
    const key = this.dayKey(userId, RedisTransactionVolumeCache.normalize(dt))
    const val = await redis.get(key)
    return val ? Number(val) : 0
  }

  /**
   * Retrieves the monthly transaction volume for a specific user.
   *
   * @param {string | number} userId - The unique identifier for the user.
   * @param {Date | string | DateTime} [dt] - The optional date to specify the month and year for the volume lookup. Defaults to the current date if not provided.
   * @return {Promise<number>} A promise that resolves to the monthly transaction volume as a number. Returns 0 if no data is available.
   */
  async getMonthlyVolume(userId: string | number, dt?: Date | string | DateTime): Promise<number> {
    const key = this.monthKey(userId, RedisTransactionVolumeCache.normalize(dt))
    const val = await redis.get(key)
    return val ? Number(val) : 0
  }

  /**
   * Retrieves the monthly volumes for a list of users.
   *
   * @param {string[]} userIds - The list of user identifiers.
   * @param {Date | string | DateTime} [dt] - The optional date to specify the month.
   * @returns {Promise<Record<string, number>>} A promise that resolves to a record of user ID and their monthly volume.
   */
  async getMonthlyVolumesForUsers(
    userIds: string[],
    dt?: Date | string | DateTime
  ): Promise<Record<string, number>> {
    const ts = RedisTransactionVolumeCache.normalize(dt)
    const pipeline = redis.pipeline()

    userIds.forEach((userId) => {
      pipeline.get(this.monthKey(userId, ts))
    })

    const results = await pipeline.exec()
    const volumes: Record<string, number> = {}

    userIds.forEach((userId, index) => {
      const val = results ? results[index] : null
      volumes[userId] =
        val && Array.isArray(val) ? (val[1] ? Number(val[1]) : 0) : val ? Number(val) : 0
    })

    return volumes
  }
  /**
   * Clears all transaction volumes for a specific user (daily and monthly).
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  async clearVolume(userId: string): Promise<void> {
    const pattern = `tx:vol:user:${userId}:*`
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }
}
