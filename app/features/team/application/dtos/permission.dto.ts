import { PaginationMeta } from '#features/team/application/dtos/member.dto'

export interface CreatePermissionRequestDto {
  slug: string
  name: string
  description?: string
}

export interface UpdatePermissionRequestDto {
  name?: string
  description?: string
}

export interface PermissionResponseDto {
  id: number
  slug: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SimplePermissionResponseDto {
  id: number
  slug: string
  name: string
  description: string | null
}

export interface PaginatedPermissionResponseDto {
  data: PermissionResponseDto[]
  meta: PaginationMeta
}
