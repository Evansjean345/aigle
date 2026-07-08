import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import MembershipConsentOtpTemplate from '#aiglebusiness/membership/domain/templates/membership_consent_otp_template'
import { MemberResponseDTO } from '#aiglebusiness/membership/application/dtos/member.dto'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import InvitationTokenInvalidException from '#aiglebusiness/membership/domain/exceptions/invitation_token_invalid_exception'
import InvitationExpiredException from '#aiglebusiness/membership/domain/exceptions/invitation_expired_exception'

/**
 * Accepte une invitation : valide le token puis l'OTP (consentement), et bascule
 * le membre PENDING → ACTIVE (token effacé). Les exceptions OTP (invalide, expiré,
 * verrouillé) sont propagées telles quelles depuis le core.
 */
@inject()
export default class AcceptInvitationUseCase {
  constructor(
    private readonly memberRepository: OrganisationMemberRepository,
    private readonly userDirectory: UserDirectoryService,
    private readonly otpVerificationService: OtpVerificationService
  ) {}

  async execute(token: string, otp: string): Promise<MemberResponseDTO> {
    const member = await this.memberRepository.findByInvitationToken(token)
    if (!member || member.status !== MemberStatus.PENDING) {
      throw new InvitationTokenInvalidException()
    }

    if (member.invitationExpiresAt && member.invitationExpiresAt < DateTime.now()) {
      throw new InvitationExpiredException()
    }

    const invitee = await this.userDirectory.findById(member.userId)

    if (!invitee) {
      throw new InvitationTokenInvalidException()
    }

    await this.otpVerificationService.verify(
      { identifier: invitee.phone, enteredOtp: otp },
      new MembershipConsentOtpTemplate()
    )

    await this.memberRepository.updateStatus(member.id, MemberStatus.ACTIVE, true)

    const activated = await this.memberRepository.findById(member.id)
    return MemberResponseDTO.fromModel(activated!, invitee)
  }
}
