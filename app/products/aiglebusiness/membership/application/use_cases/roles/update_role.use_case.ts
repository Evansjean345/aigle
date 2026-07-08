import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import {
  type UpdateRoleRequestDto,
  RoleResponseDTO,
} from '#aiglebusiness/membership/application/dtos/role.dto'
import { assertValidPermissions } from '#aiglebusiness/membership/domain/permissions.config'
import RoleNotFoundException from '#aiglebusiness/membership/domain/exceptions/role_not_found_exception'
import SystemRoleImmutableException from '#aiglebusiness/membership/domain/exceptions/system_role_immutable_exception'

/**
 * Édite un rôle : nom et/ou remplacement complet des permissions. Le slug reste
 * immuable. Le rôle système (OWNER) ne peut pas être modifié.
 */
@inject()
export default class UpdateRoleUseCase {
  constructor(private readonly roleRepository: OrganisationRoleRepository) {}

  async execute(request: UpdateRoleRequestDto): Promise<RoleResponseDTO> {
    const role = await this.roleRepository.findById(request.roleId)

    if (!role || role.organisationId !== request.organisationId) {
      throw new RoleNotFoundException()
    }

    if (role.isSystem) {
      throw new SystemRoleImmutableException()
    }

    if (request.permissionSlugs !== undefined) {
      assertValidPermissions(request.permissionSlugs)
    }

    await db.transaction(async (trx) => {
      if (request.name !== undefined) {
        await this.roleRepository.updateName(role.id, request.name, trx)
      }
      if (request.permissionSlugs !== undefined) {
        await this.roleRepository.replacePermissions(role.id, request.permissionSlugs, trx)
      }
    })

    const updated = await this.roleRepository.findById(role.id)
    return RoleResponseDTO.fromModel(updated!)
  }
}
