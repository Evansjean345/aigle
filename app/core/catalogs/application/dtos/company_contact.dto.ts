import { type ContactType } from '#core/catalogs/domain/models/company_contact'

export interface CompanyContactResponseDTO {
  id: number
  type: ContactType
  value: string
  isActive: boolean
}

export interface UpdateCompanyContactDTO {
  value?: string
  isActive?: boolean
}
