import { DateTime } from 'luxon'

export default abstract class TransactionVolumeCache {
  /**
   * Increments the transaction volume for a user in a cache on success. Updates cache keys for both daily and monthly tracking.
   *
   * @param {Object} params - The parameters for the operation.
   * @param {string} params.userId - The unique identifier for the user whose volume is being incremented.
   * @param {number} params.amount - The amount to increment the transaction volume by.
   * @param {Date|string|DateTime} [params.timestamp] - The timestamp associated with the operation. Defaults to the current time if not provided.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  abstract incrementOnSuccess(params: {
    userId: string
    amount: number
    timestamp?: Date | string | DateTime
  }): Promise<void>

  /**
   * Retrieves the daily transaction volume for a specific user based on the given date.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {Date | string | DateTime} [dt] - The date for which the daily volume is to be retrieved. If not provided, defaults to the current date.
   * @return {Promise<number>} A promise that resolves to the daily transaction volume as a number.
   */
  abstract getDailyVolume(userId: string, dt?: Date | string | DateTime): Promise<number>

  /**
   * Retrieves the monthly transaction volume for a specific user.
   *
   * @param {string | number} userId - The unique identifier for the user.
   * @param {Date | string | DateTime} [dt] - The optional date to specify the month and year for the volume lookup. Defaults to the current date if not provided.
   * @return {Promise<number>} A promise that resolves to the monthly transaction volume as a number. Returns 0 if no data is available.
   */
  abstract getMonthlyVolume(userId: string | number, dt?: Date | string | DateTime): Promise<number>

  /**
   * Marks a transaction as processed in the redis datastore with a specified time-to-live (TTL).
   *
   * @param {string} txId - The unique identifier of the transaction to mark as processed.
   * @param {number} [ttlSeconds=86400] - The time-to-live for the key, in seconds. Default is 86400 seconds (1 day).
   * @return {Promise<boolean>} A promise that resolves to `true` if the operation was successful, otherwise `false`.
   */
  abstract markProcessed(txId: string, ttlSeconds?: number): Promise<boolean>
}
