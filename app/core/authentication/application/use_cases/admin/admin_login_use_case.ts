import { inject } from '@adonisjs/core'
import AdminAuthService from '#core/authentication/application/services/admin/admin_auth_service'
import AdminOtpAttemptGuard from '#core/authentication/application/services/admin/admin_otp_attempt_guard'
import OtpSendingService from '#core/otp/application/services/otp_sending_service'
import AdminLoginOtpTemplate from '#core/otp/infrastructure/templates/admin_login_otp_template'
import {
  AdminLoginRequestDto,
  AdminLoginChallengeDto,
} from '#core/authentication/application/dtos/admin/admin_login.dto'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

export interface Token {
  type: 'bearer'
  value: string
  expiresAt?: string
}

@inject()
export default class AdminLoginUseCase {
  constructor(
    private adminAuthService: AdminAuthService,
    private otpSendingService: OtpSendingService,
    private otpAttemptGuard: AdminOtpAttemptGuard
  ) {}

  /**
   * First step of the admin 2FA login flow.
   *
   * Verifies credentials, then dispatches a one-time email OTP. Tokens are
   * issued only on the second step (`VerifyAdminOtpUseCase`) once the OTP is
   * confirmed. No token leaks if the password is correct but the OTP is not.
   */
  async execute(data: AdminLoginRequestDto, ip: string): Promise<AdminLoginChallengeDto> {
    const admin = await this.adminAuthService.verifyCredentialsForChallenge(
      data.email,
      data.password,
      ip
    )

    // Block at the dispatch boundary too — without this, an admin locked by
    // the verify-side OTP guard could keep regenerating email OTPs by
    // re-submitting valid credentials.
    await this.otpAttemptGuard.assertNotBlocked(admin.email)

    await this.otpSendingService.send(admin.email, admin.id.toString(), new AdminLoginOtpTemplate())

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'LOGIN_OTP_SENT',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role?.name ?? null,
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress: ip,
        metadata: { email: admin.email, mfa: 'email_otp' },
      })
      .catch(() => {})

    return AdminLoginChallengeDto.build(admin.email)
  }
}
