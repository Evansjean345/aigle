import type { BusinessPermission } from '#aiglebusiness/membership/domain/permissions.config'

/**
 * Une permission du catalogue, telle qu'exposée à l'organisation qui compose
 * ses rôles (avec le flag `sensitive` pour l'avertissement UI).
 */
export class PermissionResponseDTO {
  declare slug: string
  declare name: string
  declare description: string
  declare sensitive: boolean

  static fromCatalog(permission: BusinessPermission): PermissionResponseDTO {
    const dto = new PermissionResponseDTO()
    dto.slug = permission.slug
    dto.name = permission.name
    dto.description = permission.description
    dto.sensitive = permission.sensitive
    return dto
  }
}
