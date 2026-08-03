import { type PaginationMeta } from '#core/team/application/dtos/member.dto'

/**
 * Une permission telle que servie au back-office : la déclaration en code, augmentée de son
 * identifiant persisté.
 *
 * `id` vaut `null` quand la permission n'a pas encore été écrite en base : elle est alors visible
 * mais pas attachable à un rôle, ce qui signale qu'une synchronisation manque.
 */
export interface CatalogPermissionResponseDto {
  id: number | null
  slug: string
  name: string
  description: string
  sensitive: boolean
}

export interface PaginatedCatalogPermissionResponseDto {
  data: CatalogPermissionResponseDto[]
  meta: PaginationMeta
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
