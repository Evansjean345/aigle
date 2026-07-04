import DebitPhone from '#core/user/domain/models/debit_phone'
import DebitPhoneRepository from '#core/user/domain/interfaces/debit_phone_repository'

/**
 * A repository implementation for managing and querying `DebitPhone` records.
 * Extends the base `DebitPhoneRepository` and provides methods for interacting with the database.
 */
export default class DebitPhoneRepositoryImpl extends DebitPhoneRepository {
  /**
   * Retrieves a DebitPhone record that matches the provided id and userId.
   *
   * @param {number} id - The unique identifier of the DebitPhone record to find.
   * @param {string} userId - The identifier of the user associated with the record.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the found DebitPhone record or null if no record matches.
   */
  async findById(id: number, userId: string): Promise<DebitPhone | null> {
    return DebitPhone.query().where('id', id).where('userId', userId).first()
  }

  /**
   * Retrieves a DebitPhone record based on the provided user ID and phone number.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} phone - The phone number associated with the user.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the matching DebitPhone record, or null if no match is found.
   */
  async findByUserAndPhone(userId: string, phone: string): Promise<DebitPhone | null> {
    return DebitPhone.query().where('userId', userId).where('phone', phone).first()
  }

  /**
   * Finds an active DebitPhone record associated with the given user and provider.
   *
   * @param {string} userId - The ID of the user for whom the DebitPhone is queried.
   * @param {number} providerId - The ID of the provider associated with the DebitPhone.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the matching DebitPhone record if found, otherwise null.
   */
  async findByUserAndProvider(userId: string, providerId: number): Promise<DebitPhone | null> {
    return DebitPhone.query().where('userId', userId).where('providerId', providerId).first()
  }

  /**
   * Retrieves a list of verified and active DebitPhone records associated with a specified user.
   *
   * @param {string} userId - The unique identifier of the user whose verified DebitPhone records are to be fetched.
   * @return {Promise<DebitPhone[]>} A promise that resolves to an array of DebitPhone objects that are verified and active for the given user.
   */
  async findVerifiedByUser(userId: string): Promise<DebitPhone[]> {
    return DebitPhone.query()
      .where('userId', userId)
      .where('isVerified', true)
      .where('isActive', true)
  }

  /**
   * Finds a verified and active provider for a given user and provider.
   *
   * @param {string} userId - The ID of the user to search for.
   * @param {number} providerId - The ID of the provider to search for.
   * @return {Promise<DebitPhone|null>} A promise that resolves to the verified provider if found, or null if no match exists.
   */
  async findVerifiedByProvider(userId: string, providerId: number): Promise<DebitPhone | null> {
    return DebitPhone.query()
      .where('userId', userId)
      .where('providerId', providerId)
      .where('isVerified', true)
      .where('isActive', true)
      .first()
  }

  /**
   * Persists the given DebitPhone instance to the database.
   *
   * @param {DebitPhone} debitPhone - The DebitPhone instance to be saved.
   * @return {Promise<DebitPhone>} A promise resolving to the saved DebitPhone instance.
   */
  async save(debitPhone: DebitPhone): Promise<DebitPhone> {
    return debitPhone.save()
  }

  /**
   * Deletes a record from the DebitPhone database that matches the specified id and userId.
   *
   * @param {number} id - The unique identifier of the record to be deleted.
   * @param {string} userId - The unique identifier of the user associated with the record.
   * @return {Promise<void>} A promise that resolves when the record is successfully deleted.
   */
  async delete(id: number, userId: string): Promise<void> {
    await DebitPhone.query().where('id', id).where('userId', userId).delete()
  }

  /**
   * Counts the number of active debit phone records associated with a given user.
   *
   * @param {string} userId - The unique identifier of the user whose records are to be counted.
   * @return {Promise<number>} A promise that resolves to the total count of active debit phone records for the specified user.
   */
  async countByUser(userId: string): Promise<number> {
    const result = await DebitPhone.query()
      .where('userId', userId)
      .where('isActive', true)
      .count('* as total')
    return Number(result[0].$extras.total)
  }
}
