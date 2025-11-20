export interface ServiceTypeResponseDto {
  id: number
  code: string
  label: string
  description?: string | null
  createdAt?: string | Date
  updatedAt?: string | Date
}
