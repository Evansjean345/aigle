import { inject } from '@adonisjs/core'
import CompanyContactRepository from '#core/catalog/catalogs/domain/interfaces/company_contact_repository'
import { CompanyContactResponseDTO } from '#core/catalog/catalogs/application/dtos/company_contact.dto'

@inject()
export default class GetActiveCompanyContactsUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {CompanyContactRepository} contactRepository - The repository responsible for managing company contact data.
   */
  constructor(private contactRepository: CompanyContactRepository) {}

  /**
   * Executes the method to retrieve active contact records and map them to a specific response format.
   *
   * @return {Promise<CompanyContactResponseDTO[]>} A promise that resolves to an array of company contact response DTOs.
   */
  async execute(): Promise<CompanyContactResponseDTO[]> {
    const contacts = await this.contactRepository.findActive()
    return contacts.map((contact) => ({
      id: contact.id,
      type: contact.type,
      value: contact.value,
      isActive: contact.isActive,
    }))
  }
}
