import type DebitPhone from '#core/user/domain/models/debit_phone'

/**
 * An abstract class representing a repository for managing DebitPhone entities.
 * This serves as a blueprint for implementing data access operations related to debit phone records.
 */
export default abstract class DebitPhoneRepository {
  /**
   * Retrieves a debit phone record by its unique identifier and associated user identifier.
   *
   * @param {number} id - The unique identifier of the debit phone record.
   * @param {string} userId - The identifier of the user associated with the debit phone record.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the matching DebitPhone object if found, or null if no record matches the provided criteria.
   */
  abstract findById(id: number, userId: string): Promise<DebitPhone | null>

  /**
   * Retrieves a DebitPhone record based on the provided user ID and phone number.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} phone - The phone number associated with the user.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the DebitPhone object if found, or null if no matching record exists.
   */
  abstract findByUserAndPhone(userId: string, phone: string): Promise<DebitPhone | null>

  /**
   * Retrieves a DebitPhone record based on the provided user ID and provider ID.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {number} providerId - The unique identifier of the provider.
   * @return {Promise<DebitPhone | null>} A promise that resolves to a DebitPhone object if found, or null if no matching record exists.
   */
  abstract findByUserAndProvider(userId: string, providerId: number): Promise<DebitPhone | null>

  /**
   * Finds and returns a verified DebitPhone associated with a user and a provider.
   *
   * @param {string} userId - The unique identifier of the user to search for.
   * @return {Promise<DebitPhone | null>} A promise that resolves to the verified DebitPhone if found, or null if no match exists.
   */
  abstract findVerifiedByUser(userId: string): Promise<DebitPhone[]>

  /**
   * Finds a verified debit phone associated with a specific user and provider.
   *
   * @param {string} userId - The unique identifier for the user.
   * @param {number} providerId - The unique identifier for the provider.
   * @return {Promise<DebitPhone|null>} A promise that resolves to a DebitPhone object if found, or null if no match exists.
   */
  abstract findVerifiedByProvider(userId: string, providerId: number): Promise<DebitPhone | null>

  /**
   * Saves the provided DebitPhone object.
   *
   * @param {DebitPhone} debitPhone The debitPhone object to be saved.
   * @return {Promise<DebitPhone>} A promise that resolves with the saved DebitPhone object.
   */
  abstract save(debitPhone: DebitPhone): Promise<DebitPhone>

  /**
   * Deletes a resource identified by its ID and associated with a specific user.
   *
   * @param {number} id - The unique identifier of the resource to be deleted.
   * @param {string} userId - The identifier of the user associated with the resource.
   * @return {Promise<void>} A promise that resolves when the resource is successfully deleted.
   */
  abstract delete(id: number, userId: string): Promise<void>

  /**
   * Counts the number of records associated with a specific user.
   *
   * @param userId The unique identifier of the user whose records are to be counted.
   * @return A promise that resolves to the number of records associated with the given user.
   */
  abstract countByUser(userId: string): Promise<number>
}
