import { inject } from '@adonisjs/core'
import CompanyContactRepository from '#core/catalogs/domain/interfaces/company_contact_repository'
import {
  UpdateCompanyContactDTO,
  CompanyContactResponseDTO,
} from '#core/catalogs/application/dtos/company_contact.dto'

@inject()
export default class UpdateCompanyContactUseCase {
  constructor(private contactRepository: CompanyContactRepository) {}

  async execute(id: number, data: UpdateCompanyContactDTO): Promise<CompanyContactResponseDTO> {
    const contact = await this.contactRepository.update(id, data)
    return {
      id: contact.id,
      type: contact.type,
      value: contact.value,
      isActive: contact.isActive,
    }
  }
}
