import { inject } from '@adonisjs/core'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import AdminAuthService from '#core/identity/authentication/application/services/admin/admin_auth_service'
import AdminOtpAttemptGuard from '#core/identity/authentication/application/services/admin/admin_otp_attempt_guard'
import AdminLoginOtpTemplate from '#core/identity/otp/domain/templates/admin_login_otp_template'
import AdminSetupOtpTemplate from '#core/identity/otp/domain/templates/admin_setup_otp_template'
import { AdminLoginResponseDto } from '#core/identity/authentication/application/dtos/admin/admin_login.dto'
import AdminNotFoundException from '#core/team/domain/exceptions/admin_not_found_exception'
import OtpLockedException from '#core/identity/otp/domain/exceptions/otp_locked_exception'
import emitter from '@adonisjs/core/services/emitter'

import { AuditResult } from '#core/audit/domain/enums'

export interface VerifyAdminOtpRequestDto {
  email: string
  otp: string
  ipAddress?: string | null
}

@inject()
export default class VerifyAdminOtpUseCase {
  constructor(
    private adminRepository: AdminRepository,
    private otpVerificationService: OtpVerificationService,
    private adminAuthService: AdminAuthService,
    private otpAttemptGuard: AdminOtpAttemptGuard
  ) {}

  /**
   * Verifies an OTP submitted by an admin and issues authentication tokens.
   *
   * This endpoint serves two distinct contexts and dispatches based on the
   * admin's account state:
   *
   *  - **Setup OTP** (`isActive === false`): completes the post-invitation
   *    onboarding — activates the account, clears the invitation token, and
   *    issues the first set of tokens. Verifies against `ADMIN_SETUP` template.
   *
   *  - **Login OTP** (`isActive === true`): second leg of the 2FA login flow,
   *    issues tokens and updates last-login metadata. Verifies against the
   *    stricter `ADMIN_LOGIN` template (5min TTL).
   *
   * Brute-force protection is enforced via `AdminOtpAttemptGuard` (sliding
   * window 24h, paliers 5→9 mirroring the password guard, separate keyspace
   * to avoid cross-pollution with password failures).
   *
   * Throwing a generic `AdminNotFoundException` on missing accounts prevents
   * email enumeration through this endpoint.
   */
  async execute(data: VerifyAdminOtpRequestDto): Promise<AdminLoginResponseDto> {
    const admin = await this.adminRepository.findByEmail(data.email)

    if (!admin) {
      throw new AdminNotFoundException()
    }

    // Block before probing — the attacker must not be able to test codes
    // during a temporary block.
    await this.otpAttemptGuard.assertNotBlocked(admin.email)

    const isSetupFlow = !admin.isActive
    const template = isSetupFlow ? new AdminSetupOtpTemplate() : new AdminLoginOtpTemplate()

    try {
      await this.otpVerificationService.verify(
        { identifier: admin.email, enteredOtp: data.otp },
        template
      )
    } catch (error) {
      // Only count fully-exhausted OTPs as brute-force attempts at the email
      // scope. A typo (InvalidOtpException) is already throttled by
      // OtpVerificationService.maxAttempts on the OTP itself; counting each
      // typo here would double-lock a legitimate fat-fingering admin. The
      // guard's real job is to catch the cross-OTP attack pattern: an
      // attacker who exhausts one OTP, regenerates a fresh one, and starts
      // probing again. Each `OtpLockedException` = one such cycle attempted.
      if (error instanceof OtpLockedException) {
        await this.otpAttemptGuard.recordFailure(admin.email, data.ipAddress ?? null)

        emitter
          .emit('activity:audit', {
            eventCategory: 'AUTH',
            eventAction: 'OTP_EXHAUSTED',
            actorId: String(admin.id),
            actorType: 'Admin',
            actorRole: admin.role?.name ?? null,
            targetType: 'Member',
            targetId: String(admin.id),
            result: AuditResult.FAILURE,
            ipAddress: data.ipAddress ?? null,
            errorCode: 'OTP_LOCKED',
            errorMessage: 'OTP attempts exhausted',
            metadata: { email: admin.email, mfa: isSetupFlow ? 'setup' : 'email_otp' },
          })
          .catch(() => {})
      }
      throw error
    }

    // Success → wipe both the per-OTP counter (already done by
    // OtpVerificationService.delete) and the email-scoped sliding window.
    await this.otpAttemptGuard.recordSuccess(admin.email)

    if (isSetupFlow) {
      admin.isActive = true
      admin.invitationToken = null
      admin.invitationExpiresAt = null
      await this.adminRepository.save(admin)
    }

    await admin.load('role', (query) => query.preload('permissions'))

    const tokens = isSetupFlow
      ? await this.adminAuthService.generateTokens(admin)
      : await this.adminAuthService.completeLoginAfterOtp(admin, data.ipAddress ?? '')

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: isSetupFlow ? 'OTP_VERIFIED' : 'LOGIN_OTP_VERIFIED',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role?.name ?? null,
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress: data.ipAddress ?? null,
        metadata: { email: admin.email, mfa: isSetupFlow ? 'setup' : 'email_otp' },
      })
      .catch(() => {})

    return AdminLoginResponseDto.fromAdmin(
      admin,
      this.adminAuthService.formatToken(tokens.access),
      this.adminAuthService.formatToken(tokens.refresh)
    )
  }
}
