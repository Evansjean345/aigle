import { ProviderType } from '#features/catalogs/domain/models/provider'

export interface ProviderResponseDto {
  id: number
  code: string
  name: string
  type: ProviderType
  logo?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}
