import { inject } from '@adonisjs/core'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import {
  type ChangeMemberRoleRequestDto,
  MemberResponseDTO,
} from '#aiglebusiness/membership/application/dtos/member.dto'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'
import RoleNotFoundException from '#aiglebusiness/membership/domain/exceptions/role_not_found_exception'
import MemberNotFoundException from '#aiglebusiness/membership/domain/exceptions/member_not_found_exception'
import OwnerMemberImmutableException from '#aiglebusiness/membership/domain/exceptions/owner_member_immutable_exception'

/**
 * Réaffecte le rôle d'un membre. Le membre OWNER (rôle système) est protégé, et le
 * nouveau rôle doit appartenir à l'organisation.
 */
@inject()
export default class ChangeMemberRoleUseCase {
  constructor(
    private readonly roleRepository: OrganisationRoleRepository,
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly userDirectory: UserDirectoryService
  ) {}

  async execute(request: ChangeMemberRoleRequestDto): Promise<MemberResponseDTO> {
    const member = await this.memberRepository.findById(request.memberId)

    if (!member || member.organisationId !== request.organisationId) {
      throw new MemberNotFoundException()
    }

    if (member.role?.slug === OWNER_ROLE_SLUG) {
      throw new OwnerMemberImmutableException()
    }

    const role = await this.roleRepository.findById(request.roleId)

    if (!role || role.organisationId !== request.organisationId) {
      throw new RoleNotFoundException()
    }

    await this.memberRepository.updateRole(member.id, request.roleId)

    const updated = await this.memberRepository.findById(member.id)
    const user = await this.userDirectory.findById(member.userId)
    return MemberResponseDTO.fromModel(updated!, user)
  }
}
