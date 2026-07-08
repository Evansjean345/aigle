import { inject } from '@adonisjs/core'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import InvitationService from '#aiglebusiness/membership/application/services/invitation_service'
import { MemberResponseDTO } from '#aiglebusiness/membership/application/dtos/member.dto'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import MemberNotFoundException from '#aiglebusiness/membership/domain/exceptions/member_not_found_exception'

/**
 * Régénère le token d'un membre encore PENDING et renvoie le SMS de lien
 * (ex : lien expiré). Ne s'applique qu'à une invitation en attente.
 */
@inject()
export default class ResendInvitationUseCase {
  constructor(
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly organisationRepository: OrganisationRepository,
    private readonly userDirectory: UserDirectoryService,
    private readonly invitationService: InvitationService
  ) {}

  async execute(organisationId: string, memberId: number): Promise<MemberResponseDTO> {
    const member = await this.memberRepository.findById(memberId)

    if (
      !member ||
      member.organisationId !== organisationId ||
      member.status !== MemberStatus.PENDING
    ) {
      throw new MemberNotFoundException()
    }

    const { token, expiresAt } = this.invitationService.newToken()
    await this.memberRepository.setInvitation(member.id, member.roleId, token, expiresAt)

    const invitee = await this.userDirectory.findById(member.userId)

    if (invitee) {
      const organisation = await this.organisationRepository.findByOrganisationId(organisationId)
      await this.invitationService.sendLinkSms(
        invitee.phone,
        token,
        organisation?.name ?? 'Une organisation'
      )
    }

    const refreshed = await this.memberRepository.findById(member.id)
    return MemberResponseDTO.fromModel(refreshed!, invitee)
  }
}
