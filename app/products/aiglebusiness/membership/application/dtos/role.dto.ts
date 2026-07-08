import type OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'

// ── RequestDto (input use case) ─────────────────────────────────────

/**
 * Création d'un rôle. `organisationId` vient de l'URL, le reste du payload.
 */
export interface CreateRoleRequestDto {
  organisationId: string
  name: string
  permissionSlugs: string[]
}

/**
 * Édition d'un rôle : nom et/ou remplacement complet des permissions.
 */
export interface UpdateRoleRequestDto {
  organisationId: string
  roleId: number
  name?: string
  permissionSlugs?: string[]
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class RoleResponseDTO {
  declare id: number
  declare slug: string
  declare name: string
  declare isSystem: boolean
  declare permissions: string[]

  static fromModel(role: OrganisationRole): RoleResponseDTO {
    const dto = new RoleResponseDTO()
    dto.id = role.id
    dto.slug = role.slug
    dto.name = role.name
    dto.isSystem = role.isSystem
    dto.permissions = role.permissions?.map((p) => p.permissionSlug) ?? []
    return dto
  }
}
