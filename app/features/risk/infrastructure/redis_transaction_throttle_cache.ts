import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'
import type TransactionThrottleCache from '#features/risk/domain/interfaces/transaction_throttle_cache'
import TransferThrottleException from '#features/risk/infrastructure/exceptions/transfer_throttle_exception'

/**
 * A cache implementation using Redis to manage transaction throttling for users.
 * This class enforces rate-limiting policies by tracking the last successful transactions
 * and ensuring a minimum time interval between successive transactions.
 * It provides methods to set, retrieve, and verify throttling based on user activity.
 */
export default class RedisTransactionThrottleCache implements TransactionThrottleCache {
  private readonly connection = redis.connection('transactions')

  /**
   * A constant string used as a prefix for keys in a throttling system.
   * It is typically utilized to uniquely identify and manage throttling rules
   * or limits for users in a distributed or rate-limiting context.
   */
  private readonly THROTTLE_KEY_PREFIX = 'tx:throttle:user:'

  /**
   * Represents the duration in seconds after which a specific action or entity expires.
   * This variable can be used to define time-based constraints or validity intervals.
   *
   * Value: 65 seconds
   */
  private readonly EXPIRATION_SECONDS = 65 // Un peu plus d'une minute

  /**
   * Constructs and retrieves a unique throttle key for the given user.
   *
   * @param userId The identifier for the user.
   * @return A string representing the unique throttle key.
   */
  private getKey(userId: string): string {
    return `${this.THROTTLE_KEY_PREFIX}${userId}`
  }

  /**
   * Updates the last success time for a user in the system, storing it in the Redis cache.
   *
   * @param {string} userId - The unique identifier for the user whose last success time is being set.
   * @param {Date | string | DateTime} [timestamp] - Optional parameter representing the timestamp to set.
   *   If not provided, the current system time will be used.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  async setLastSuccessTime(userId: string, timestamp?: Date | string | DateTime): Promise<void> {
    const key = this.getKey(userId)
    let isoDate: string

    if (!timestamp) isoDate = DateTime.now().toISO()!
    else if (timestamp instanceof DateTime) isoDate = timestamp.toISO()!
    else if (timestamp instanceof Date) isoDate = DateTime.fromJSDate(timestamp).toISO()!
    else isoDate = timestamp

    await this.connection.setex(key, this.EXPIRATION_SECONDS, isoDate)
  }

  /**
   * Retrieves the last recorded successful operation time for a given user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<DateTime | null>} A promise that resolves to a DateTime object representing the last success time, or null if no record exists.
   */
  async getLastSuccessTime(userId: string): Promise<DateTime | null> {
    const val = await this.connection.get(this.getKey(userId))
    return val ? DateTime.fromISO(val) : null
  }

  /**
   * Verifies if a user action is being throttled based on the time of the last successful action.
   *
   * @param {string} userId - The unique identifier of the user performing the action.
   * @return {Promise<void>} A promise that resolves if the throttle check passes or throws an exception if throttled.
   */
  async verifyThrottle(userId: string): Promise<void> {
    const lastTime = await this.getLastSuccessTime(userId)
    if (lastTime) {
      const diffInSeconds = DateTime.now().diff(lastTime, 'seconds').seconds
      if (diffInSeconds < 60) {
        throw new TransferThrottleException()
      }
    }
  }
}
