import redis from '@adonisjs/redis/services/main'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * A class to manage transaction failure counts using Redis, with features to track, limit,
 * and reset transaction failures for specific users based on thresholds and time-to-live (TTL).
 * This mechanism helps to enforce rate-limiting and prevent excessive transaction retries.
 *
 * Implements the `TransactionFailureCache` interface.
 */
export default class RedisTransactionFailureCache implements TransactionFailureCache {
  private readonly FAILURE_COUNT_PREFIX = 'tx:failure:count:user:'
  private readonly FAILURE_BLOCK_PREFIX = 'tx:failure:block:user:'

  private readonly THRESHOLDS = [
    { failures: 10, duration: 14400, label: '4 heures' },
    { failures: 7, duration: 1800, label: '30 minutes' },
    { failures: 5, duration: 300, label: '5 minutes' },
    { failures: 3, duration: 30, label: '30 secondes' },
  ]

  /**
   * Constructs and returns a unique count key for a user based on their ID.
   *
   * @param userId The unique identifier of the user.
   * @return A string representing the count key for the user.
   */
  private getCountKey(userId: string): string {
    return `${this.FAILURE_COUNT_PREFIX}${userId}`
  }

  /**
   * Constructs a unique block key by appending the user ID to a predefined prefix.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {string} A string representing the generated block key.
   */
  private getBlockKey(userId: string): string {
    return `${this.FAILURE_BLOCK_PREFIX}${userId}`
  }

  /**
   * Increments the failure counter for a given user and applies a blocking threshold if the failure count
   * reaches a predefined threshold. The counter is retained for 24 hours to allow cumulative tracking of attempts.
   *
   * @param {string} userId - The unique identifier of the user whose failure count is incremented.
   * @return {Promise<void>} A promise that resolves when the failure increment logic has been completed.
   */
  async incrementFailure(userId: string): Promise<void> {
    const countKey = this.getCountKey(userId)
    const currentCount = await redis.incr(countKey)

    const currentTtl = await redis.ttl(countKey)

    if (currentTtl < 86400) {
      await redis.expire(countKey, 86400)
    }

    // On cherche le palier correspondant au nombre d'échecs actuel
    const threshold = this.THRESHOLDS.find((t) => currentCount >= t.failures)

    if (threshold) {
      // On crée une clé de blocage avec la durée du palier
      await redis.setex(this.getBlockKey(userId), threshold.duration, 'blocked')
    }
  }

  /**
   * Verifies whether the specified user is not currently blocked from performing actions.
   * If the user is blocked, an exception is thrown indicating the remaining block duration.
   *
   * @param {string} userId - The identifier of the user to check against the block list.
   * @return {Promise<void>} A Promise that resolves if the user is not blocked, or rejects with an error if the user is blocked.
   */
  async verifyNotBlocked(userId: string): Promise<void> {
    const blockKey = this.getBlockKey(userId)
    const isBlocked = await redis.get(blockKey)

    if (isBlocked) {
      const ttl = await redis.ttl(blockKey)
      if (ttl > 0) {
        let timeRemaining: string
        if (ttl >= 3600) {
          timeRemaining = `${Math.ceil(ttl / 3600)} heures`
        } else if (ttl >= 60) {
          timeRemaining = `${Math.ceil(ttl / 60)} minutes`
        } else {
          timeRemaining = `${ttl} secondes`
        }

        throw new Exception(
          `Trop d'échecs consécutifs. Veuillez patienter ${timeRemaining} avant de réessayer.`,
          { status: 429, code: 'E_TRANSACTION_BLOCKED' }
        )
      }
    }
  }

  /**
   * Resets the failure count and block status for a specific user.
   *
   * @param {string} userId - The unique identifier of the user whose failure data is being reset.
   * @return {Promise<void>} A promise that resolves when the reset operation is complete.
   */
  async resetFailures(userId: string): Promise<void> {
    await Promise.all([redis.del(this.getCountKey(userId)), redis.del(this.getBlockKey(userId))])
  }
}
