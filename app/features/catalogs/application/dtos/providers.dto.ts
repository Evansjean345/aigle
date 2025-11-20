import { ProviderType } from '#features/catalogs/domain/models/provider'

export interface ProviderCreateDto {
  code: string
  name: string
  type: ProviderType
  logo?: string | null
}

export type ProviderUpdateDto = Partial<ProviderCreateDto>
