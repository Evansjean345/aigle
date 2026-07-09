import { inject } from '@adonisjs/core'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import InvitationTokenInvalidException from '#aiglebusiness/membership/domain/exceptions/invitation_token_invalid_exception'

/**
 * Refus d'une invitation par l'invité : le membre PENDING passe REMOVED (refus
 * explicite tracé, évite de re-solliciter). Aucun OTP requis (acte négatif).
 */
@inject()
export default class DeclineInvitationUseCase {
  constructor(private readonly memberRepository: OrganisationMemberRepository) {}

  async execute(token: string): Promise<{ id: number; userId: string; organisationId: string }> {
    const member = await this.memberRepository.findByInvitationToken(token)

    if (!member || member.status !== MemberStatus.PENDING) {
      throw new InvitationTokenInvalidException()
    }

    await this.memberRepository.updateStatus(member.id, MemberStatus.REMOVED, true)

    return { id: member.id, userId: member.userId, organisationId: member.organisationId }
  }
}
