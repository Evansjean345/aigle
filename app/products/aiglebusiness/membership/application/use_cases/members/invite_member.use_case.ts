import { inject } from '@adonisjs/core'
import OrganisationRoleRepository from '#aiglebusiness/membership/domain/interfaces/organisation_role_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import InvitationService from '#aiglebusiness/membership/application/services/invitation_service'
import { assertOrganisationAllowsTeam } from '#aiglebusiness/membership/application/authorization/team_account_policy'
import {
  type InviteMemberRequestDto,
  MemberResponseDTO,
} from '#aiglebusiness/membership/application/dtos/member.dto'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import RoleNotFoundException from '#aiglebusiness/membership/domain/exceptions/role_not_found_exception'
import SystemRoleNotAssignableException from '#aiglebusiness/membership/domain/exceptions/system_role_not_assignable_exception'
import InviteeNotAigleUserException from '#aiglebusiness/membership/domain/exceptions/invitee_not_aigle_user_exception'
import InviteeKycNotVerifiedException from '#aiglebusiness/membership/domain/exceptions/invitee_kyc_not_verified_exception'
import MemberAlreadyExistsException from '#aiglebusiness/membership/domain/exceptions/member_already_exists_exception'

/**
 * Invite un membre dans une organisation (entreprise). Résout l'invité par son
 * téléphone (doit être un user Aigle KYC-vérifié), pose une ligne membre PENDING
 * avec un token d'invitation, et envoie le SMS de lien. Selon l'état existant
 * (décision #11) : ACTIVE → 409, PENDING/REMOVED → réactive la même ligne.
 */
@inject()
export default class InviteMemberUseCase {
  constructor(
    private readonly roleRepository: OrganisationRoleRepository,
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly organisationRepository: OrganisationRepository,
    private readonly userDirectory: UserDirectoryService,
    private readonly invitationService: InvitationService
  ) {}

  async execute(request: InviteMemberRequestDto): Promise<MemberResponseDTO> {
    // Réservé aux entreprises : un marchand est mono-utilisateur (pas de membres).
    const organisation = await assertOrganisationAllowsTeam(
      this.organisationRepository,
      request.organisationId
    )

    const role = await this.roleRepository.findById(request.roleId)

    if (!role || role.organisationId !== request.organisationId) {
      throw new RoleNotFoundException()
    }

    // Un rôle système (OWNER) n'est jamais invitable : la propriété est unique et ne
    // se transmet que par transfert explicite. Sans cela, un membre avec members:manage
    // pourrait fabriquer un second propriétaire (escalade de privilèges).
    if (role.isSystem) {
      throw new SystemRoleNotAssignableException()
    }

    const invitee = await this.userDirectory.findByPhone(request.phone)

    if (!invitee) {
      throw new InviteeNotAigleUserException()
    }

    if (!invitee.kycVerified) {
      throw new InviteeKycNotVerifiedException()
    }

    const existing = await this.memberRepository.findByOrganisationAndUser(
      request.organisationId,
      invitee.userId
    )

    if (existing && existing.status === MemberStatus.ACTIVE) {
      throw new MemberAlreadyExistsException()
    }

    const { token, expiresAt } = this.invitationService.newToken()
    let member = existing

    if (existing) {
      await this.memberRepository.setInvitation(existing.id, request.roleId, token, expiresAt)
      member = await this.memberRepository.findById(existing.id)
    } else {
      member = await this.memberRepository.create({
        organisationId: request.organisationId,
        userId: invitee.userId,
        roleId: request.roleId,
        status: MemberStatus.PENDING,
        invitationToken: token,
        invitationExpiresAt: expiresAt,
      })
    }

    await this.invitationService.sendLinkSms(
      invitee.phone,
      token,
      organisation?.name ?? 'Une organisation'
    )
    return MemberResponseDTO.fromModel(member!, invitee)
  }
}
