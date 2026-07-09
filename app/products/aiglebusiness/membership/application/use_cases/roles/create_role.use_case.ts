import { inject } from '@adonisjs/core'
import string from '@adonisjs/core/helpers/string'
import db from '@adonisjs/lucid/services/db'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import { assertValidPermissions } from '#aiglebusiness/membership/domain/permissions.config'
import {
  type CreateRoleRequestDto,
  RoleResponseDTO,
} from '#aiglebusiness/membership/application/dtos/role.dto'
import RoleNameAlreadyExistsException from '#aiglebusiness/membership/domain/exceptions/role_name_already_exists_exception'

/**
 * Crée un rôle d'organisation : valide les permissions (catalogue), dérive un
 * slug unique du nom, persiste le rôle + ses permissions (atomique). La restriction
 * « entreprise seulement » est portée par le middleware `requireEnterprise` (route).
 */
@inject()
export default class CreateRoleUseCase {
  constructor(private readonly roleRepository: OrganisationRoleRepository) {}

  async execute(request: CreateRoleRequestDto): Promise<RoleResponseDTO> {
    assertValidPermissions(request.permissionSlugs)

    const slug = string.slug(request.name, { lower: true })

    const existing = await this.roleRepository.findByOrganisationAndSlug(
      request.organisationId,
      slug
    )

    if (existing) {
      throw new RoleNameAlreadyExistsException()
    }

    const roleId = await db.transaction(async (trx) => {
      const role = await this.roleRepository.create(
        {
          organisationId: request.organisationId,
          slug,
          name: request.name,
          isSystem: false,
        },
        trx
      )
      await this.roleRepository.addPermissions(role.id, request.permissionSlugs, trx)
      return role.id
    })

    const created = await this.roleRepository.findById(roleId)
    return RoleResponseDTO.fromModel(created!)
  }
}
