import { inject } from '@adonisjs/core'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import { RoleResponseDTO } from '#aiglebusiness/membership/application/dtos/role.dto'

/** Liste tous les rôles d'une organisation (système + personnalisés). */
@inject()
export default class ListRolesUseCase {
  constructor(private readonly roleRepository: OrganisationRoleRepository) {}

  async execute(organisationId: string): Promise<RoleResponseDTO[]> {
    const roles = await this.roleRepository.listByOrganisation(organisationId)
    return roles.map((role) => RoleResponseDTO.fromModel(role))
  }
}
