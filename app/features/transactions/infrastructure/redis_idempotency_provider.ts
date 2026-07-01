import redis from '@adonisjs/redis/services/main'
import type IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'

/**
 * A provider implementation that leverages Redis to ensure idempotency in distributed systems
 * by associating unique keys with specific states and managing their lifecycle with time-to-live (TTL) settings.
 * This class is particularly useful for preventing duplicate processing of requests.
 */
export default class RedisIdempotencyProvider implements IdempotencyProvider {
  private readonly connection = redis.connection('transactions')
  private redisKeyPrefix = 'tx:idempotency:'

  /**
   * Attempts to set a key in Redis with a specified time-to-live (TTL) and a 'PROCESSING' value
   * if the key does not already exist. This method ensures idempotency by marking the key as
   * 'PROCESSING' only if it has not been set before.
   *
   * @param {string} key - The unique identifier to check and set in Redis.
   * @param {number} [ttlSeconds=86400] - The time-to-live for the key in seconds. Defaults to 24 hours (86400 seconds).
   * @return {Promise<boolean>} A promise that resolves to `true` if the key was successfully set, or `false` if the key already exists.
   */
  async checkAndMark(key: string, ttlSeconds: number = 86400): Promise<boolean> {
    const redisKey = `${this.redisKeyPrefix}${key}`
    const res = await this.connection.set(redisKey, 'PROCESSING', 'EX', ttlSeconds, 'NX')
    return res === 'OK'
  }

  /**
   * Retrieves a value from the Redis store associated with the provided key.
   *
   * @param {string} key - The unique key used to retrieve the corresponding value from Redis.
   * @return {Promise<string | null>} A promise that resolves with the value from Redis if found, or null if the key does not exist.
   */
  async get(key: string): Promise<string | null> {
    const redisKey = `${this.redisKeyPrefix}${key}`
    return this.connection.get(redisKey)
  }

  /**
   * Updates a value in the Redis store with a specified key and time-to-live (TTL).
   *
   * @param {string} key - The unique key used to store the value in Redis.
   * @param {string} value - The value to be stored in Redis associated with the key.
   * @param {number} [ttlSeconds=86400] - Time-to-live (TTL) in seconds for the stored key. Defaults to 86400 seconds (24 hours).
   * @return {Promise<void>} A promise that resolves when the value is successfully updated in Redis.
   */
  async update(key: string, value: string, ttlSeconds: number = 86400): Promise<void> {
    const redisKey = `${this.redisKeyPrefix}${key}`
    await this.connection.set(redisKey, value, 'EX', ttlSeconds)
  }

  /**
   * Deletes an idempotency key from Redis. No-op if the key does not exist.
   *
   * @param {string} key - The unique key to remove.
   * @return {Promise<void>} A promise that resolves once the deletion is complete.
   */
  async delete(key: string): Promise<void> {
    const redisKey = `${this.redisKeyPrefix}${key}`
    await this.connection.del(redisKey)
  }
}
