import CompanyContact from '#core/catalogs/domain/models/company_contact'
import CompanyContactRepository from '#core/catalogs/domain/interfaces/company_contact_repository'

export default class CompanyContactRepositoryImpl implements CompanyContactRepository {
  /**
   * Retrieves all company contact records from the database.
   *
   * @return {Promise<CompanyContact[]>} A promise that resolves to an array of CompanyContact objects.
   */
  async findAll(): Promise<CompanyContact[]> {
    return await CompanyContact.all()
  }

  /**
   * Retrieves a list of active company contacts.
   *
   * @return {Promise<CompanyContact[]>} A promise that resolves to an array of active company contact records.
   */
  async findActive(): Promise<CompanyContact[]> {
    return CompanyContact.query().where('is_active', true).orderBy('createdAt')
  }

  /**
   * Retrieves a CompanyContact entity based on the provided ID.
   *
   * @param {number} id - The unique identifier of the CompanyContact to retrieve.
   * @return {Promise<CompanyContact | null>} A promise that resolves to the CompanyContact entity if found, or null if no entity with the given ID exists.
   */
  async findById(id: number): Promise<CompanyContact | null> {
    return await CompanyContact.find(id)
  }

  /**
   * Updates an existing CompanyContact record with the provided data.
   *
   * @param {number} id - The unique identifier of the CompanyContact to update.
   * @param {Partial<CompanyContact>} data - The partial data object containing properties to update on the CompanyContact.
   * @return {Promise<CompanyContact>} A promise that resolves to the updated CompanyContact instance.
   */
  async update(id: number, data: Partial<CompanyContact>): Promise<CompanyContact> {
    const contact = await CompanyContact.findOrFail(id)
    contact.merge(data)
    await contact.save()
    return contact
  }
}
