export interface ServiceTypeCreateDto {
  code: string
  label: string
  description?: string | null
}

export type ServiceTypeUpdateDto = Partial<ServiceTypeCreateDto>
