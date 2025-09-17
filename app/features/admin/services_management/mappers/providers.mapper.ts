import Provider from '#shared/models/provider'
import { ProviderCreateDto, ProviderUpdateDto } from '#admin/services_management/dtos/providers.dto'
import { ProviderResponseDto } from '#admin/services_management/dtos/providers.response.dto'

export const toProviderCreateDto = (input: any): ProviderCreateDto => ({
  code: String(input.code ?? ''),
  name: String(input.name ?? ''),
  type: input.type,
})

export const toProviderUpdateDto = (input: any): ProviderUpdateDto => ({
  code: input.code,
  name: input.name,
  type: input.type,
})

export const toProviderResponse = (item: Provider): ProviderResponseDto => ({
  id: item.id,
  code: item.code,
  name: item.name,
  type: item.type,
  createdAt: (item as any).createdAt,
  updatedAt: (item as any).updatedAt,
})
