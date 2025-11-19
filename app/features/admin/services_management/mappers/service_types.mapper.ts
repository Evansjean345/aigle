import ServiceType from '#features/appServices/domain/models/service_type'
import { ServiceTypeCreateDto, ServiceTypeUpdateDto } from '#admin/services_management/dtos/service_types.dto'
import { ServiceTypeResponseDto } from '#admin/services_management/dtos/service_types.response.dto'

export const toServiceTypeCreateDto = (input: any): ServiceTypeCreateDto => ({
  code: String(input.code ?? ''),
  label: String(input.label ?? ''),
  description: input.description ?? null,
})

export const toServiceTypeUpdateDto = (input: any): ServiceTypeUpdateDto => ({
  code: input.code,
  label: input.label,
  description: input.description,
})

export const toServiceTypeResponse = (item: ServiceType): ServiceTypeResponseDto => ({
  id: item.id,
  code: item.code,
  label: item.label,
  description: item.description ?? null,
  createdAt: (item as any).createdAt,
  updatedAt: (item as any).updatedAt,
})
