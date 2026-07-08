import { inject } from '@adonisjs/core'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import RoleNotFoundException from '#aiglebusiness/membership/domain/exceptions/role_not_found_exception'
import SystemRoleImmutableException from '#aiglebusiness/membership/domain/exceptions/system_role_immutable_exception'
import RoleHasMembersException from '#aiglebusiness/membership/domain/exceptions/role_has_members_exception'

/**
 * Supprime un rôle d'organisation. Le rôle système (OWNER) est protégé, et un rôle
 * encore porté par des membres actifs est refusé (409) : réassigner d'abord.
 */
@inject()
export default class DeleteRoleUseCase {
  constructor(
    private readonly roleRepository: OrganisationRoleRepository,
    private readonly memberRepository: OrganisationMemberRepository
  ) {}

  async execute(organisationId: string, roleId: number): Promise<void> {
    const role = await this.roleRepository.findById(roleId)
    if (!role || role.organisationId !== organisationId) {
      throw new RoleNotFoundException()
    }
    if (role.isSystem) {
      throw new SystemRoleImmutableException()
    }

    const activeMembers = await this.memberRepository.countActiveByRole(role.id)
    if (activeMembers > 0) {
      throw new RoleHasMembersException()
    }

    await this.roleRepository.delete(role.id)
  }
}
