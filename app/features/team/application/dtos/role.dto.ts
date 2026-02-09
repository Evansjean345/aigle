import { PermissionResponseDto } from '#features/team/application/dtos/permission.dto'
import { PaginationMeta } from '#features/team/application/dtos/member.dto'

export interface CreateRoleRequestDto {
  name: string
  description?: string
  permissionIds?: number[]
}

export interface UpdateRoleRequestDto {
  name?: string
  description?: string
  permissionIds?: number[]
}

export interface RoleResponseDto {
  id: number
  slug: string
  name: string
  description: string | null
  permissions: PermissionResponseDto[]
  createdAt: Date
  updatedAt: Date
}

export interface PaginatedRoleResponseDto {
  data: RoleResponseDto[]
  meta: PaginationMeta
}
