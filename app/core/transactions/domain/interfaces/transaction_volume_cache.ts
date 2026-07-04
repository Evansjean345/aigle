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
   * Retrieves the monthly volumes for a list of users.
   *
   * @param {string[]} userIds - The list of user identifiers.
   * @param {Date | string | DateTime} [dt] - The optional date to specify the month.
   * @returns {Promise<Record<string, number>>} A promise that resolves to a record of user ID and their monthly volume.
   */
  abstract getMonthlyVolumesForUsers(
    userIds: string[],
    dt?: Date | string | DateTime
  ): Promise<Record<string, number>>

  /**
   * Clears all transaction volumes for a specific user (daily and monthly).
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  abstract clearVolume(userId: string): Promise<void>
}
