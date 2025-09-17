import { ProviderType } from '#shared/models/provider'

export interface ProviderCreateDto {
  code: string
  name: string
  type: ProviderType
}

export type ProviderUpdateDto = Partial<ProviderCreateDto>
