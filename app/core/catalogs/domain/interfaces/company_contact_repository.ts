import type CompanyContact from '#core/catalogs/domain/models/company_contact'

/**
 * Represents a repository for managing company contact data.
 * This abstract class provides methods for retrieving, updating,
 * and querying company contact information.
 *
 * @interface
 * @template CompanyContact
 */
export default abstract class CompanyContactRepository {
  /**
   * Retrieves all company contact records.
   *
   * @return {Promise<CompanyContact[]>} A promise that resolves to an array of CompanyContact objects.
   */
  abstract findAll(): Promise<CompanyContact[]>

  /**
   * Fetches and returns a list of active company contacts.
   *
   * @return {Promise<CompanyContact[]>} A promise that resolves to an array of active CompanyContact objects.
   */
  abstract findActive(): Promise<CompanyContact[]>

  /**
   * Finds a company contact by its unique identifier.
   *
   * @param id The unique identifier of the company contact to find.
   * @return A promise that resolves to the company contact if found, or null if not found.
   */
  abstract findById(id: number): Promise<CompanyContact | null>

  /**
   * Updates the specified company contact with the provided data.
   *
   * @param {number} id - The unique identifier of the company contact to update.
   * @param {Partial<CompanyContact>} data - An object containing the partial data to update the company contact.
   * @return {Promise<CompanyContact>} A promise that resolves to the updated company contact object.
   */
  abstract update(id: number, data: Partial<CompanyContact>): Promise<CompanyContact>
}
