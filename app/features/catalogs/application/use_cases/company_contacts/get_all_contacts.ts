import { inject } from '@adonisjs/core'
import CompanyContactRepository from '#features/catalogs/domain/interfaces/company_contact_repository'
import { CompanyContactResponseDTO } from '#features/catalogs/application/dtos/company_contact.dto'

@inject()
export default class GetAllCompanyContactsUseCase {
  constructor(private contactRepository: CompanyContactRepository) {}

  /**
   * Fetches all company contact records from the repository and maps them to a defined response structure.
   *
   * @return {Promise<CompanyContactResponseDTO[]>} A promise that resolves to an array of company contact data transfer objects.
   */
  async execute(): Promise<CompanyContactResponseDTO[]> {
    const contacts = await this.contactRepository.findAll()
    return contacts.map((contact) => ({
      id: contact.id,
      type: contact.type,
      value: contact.value,
      isActive: contact.isActive,
    }))
  }
}
