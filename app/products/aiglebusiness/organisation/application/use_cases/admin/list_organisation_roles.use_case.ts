import { inject } from '@adonisjs/core'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import { OrganisationRoleAdminResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_detail.dto'

/**
 * Liste les rôles d'une organisation pour l'espace admin.
 *
 * Lecture seule : les rôles sont un contrôle interne à l'organisation, l'admin les consulte sans
 * s'y substituer.
 */
@inject()
export default class ListOrganisationRolesForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly roles: OrganisationRoleRepository,
    private readonly members: OrganisationMemberRepository
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @returns {Promise<OrganisationRoleAdminResponseDTO[]>} Les rôles, permissions résolues et
   * membres comptés.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async execute(organisationId: string): Promise<OrganisationRoleAdminResponseDTO[]> {
    const organisation = await this.organisations.findByOrganisationId(organisationId)
    if (!organisation) throw new OrganisationNotFoundException()

    const roles = await this.roles.listByOrganisation(organisationId)
    const memberCounts = await this.members.countActiveByRoleIds(roles.map((role) => role.id))

    return roles.map((role) => OrganisationRoleAdminResponseDTO.fromRole(role, memberCounts))
  }
}
