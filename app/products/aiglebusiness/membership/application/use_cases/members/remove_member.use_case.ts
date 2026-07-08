import { inject } from '@adonisjs/core'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'
import MemberNotFoundException from '#aiglebusiness/membership/domain/exceptions/member_not_found_exception'
import OwnerMemberImmutableException from '#aiglebusiness/membership/domain/exceptions/owner_member_immutable_exception'

/**
 * Retire un membre. Selon le statut (décision #16) : PENDING → suppression de la
 * ligne (annulation d'invitation) ; ACTIVE → passage REMOVED (soft, historique).
 * Le membre OWNER est protégé ; un REMOVED est idempotent (no-op).
 */
@inject()
export default class RemoveMemberUseCase {
  constructor(private readonly memberRepository: OrganisationMemberRepository) {}

  async execute(organisationId: string, memberId: number): Promise<void> {
    const member = await this.memberRepository.findById(memberId)
    if (!member || member.organisationId !== organisationId) {
      throw new MemberNotFoundException()
    }
    if (member.role?.slug === OWNER_ROLE_SLUG) {
      throw new OwnerMemberImmutableException()
    }

    if (member.status === MemberStatus.PENDING) {
      await this.memberRepository.delete(member.id)
      return
    }

    if (member.status === MemberStatus.ACTIVE) {
      await this.memberRepository.updateStatus(member.id, MemberStatus.REMOVED, true)
    }
    // REMOVED → no-op (idempotent)
  }
}
