import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import MembershipConsentOtpTemplate from '#aiglebusiness/membership/domain/templates/membership_consent_otp_template'
import { InvitationPreviewDTO } from '#aiglebusiness/membership/application/dtos/member.dto'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { maskPhone } from '#shared/utils/utiles'
import InvitationTokenInvalidException from '#aiglebusiness/membership/domain/exceptions/invitation_token_invalid_exception'
import InvitationExpiredException from '#aiglebusiness/membership/domain/exceptions/invitation_expired_exception'

/**
 * Ouverture du lien d'invitation (semi-public). Valide le token, **déclenche l'OTP**
 * au téléphone de l'invité, et renvoie une vue minimale (décision #15) : nom de
 * l'organisation + téléphone masqué — **jamais le rôle**.
 */
@inject()
export default class GetInvitationUseCase {
  constructor(
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly organisationRepository: OrganisationRepository,
    private readonly userDirectory: UserDirectoryService,
    private readonly otpSendingService: OtpSendingService
  ) {}

  async execute(token: string): Promise<InvitationPreviewDTO> {
    const member = await this.memberRepository.findByInvitationToken(token)

    if (!member || member.status !== MemberStatus.PENDING) {
      throw new InvitationTokenInvalidException()
    }

    if (member.invitationExpiresAt && member.invitationExpiresAt < DateTime.now()) {
      throw new InvitationExpiredException()
    }

    const organisation = await this.organisationRepository.findByOrganisationId(
      member.organisationId
    )

    const invitee = await this.userDirectory.findById(member.userId)

    if (!organisation || !invitee) {
      throw new InvitationTokenInvalidException()
    }

    await this.otpSendingService.send(
      invitee.phone,
      member.userId,
      new MembershipConsentOtpTemplate()
    )

    return InvitationPreviewDTO.from(organisation.name, maskPhone(invitee.phone))
  }
}
