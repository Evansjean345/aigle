import { inject } from '@adonisjs/core'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import InvalidTokenException from '#core/team/domain/exceptions/invalid_token_exception'
import ExpiredTokenException from '#core/team/domain/exceptions/expired_token_exception'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import AdminOtpAttemptGuard from '#core/team/authentication/application/services/admin_otp_attempt_guard'
import { SetupAdminPasswordRequestDto } from '#core/team/authentication/application/dtos/setup_admin_password.dto'
import { DateTime } from 'luxon'
import AdminSetupOtpTemplate from '#core/team/authentication/domain/templates/admin_setup_otp_template'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class SetupAdminPasswordUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository handling admin data operations.
   * @param {OtpSendingService} otpSendingService - The service responsible for sending OTPs.
   */
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly otpSendingService: OtpSendingService,
    private readonly otpAttemptGuard: AdminOtpAttemptGuard
  ) {}

  /**
   * Executes the process of setting up an admin password using the provided data.
   * Validates the invitation token, checks its expiration, updates the admin's password,
   * clears the token and expiration data, and sends a one-time password (OTP) to the admin's email.
   *
   * @param {SetupAdminPasswordRequestDto} data - The data required to set up the admin password, including the token and the new password.
   * @return {Promise<void>} A promise that resolves when the operation is successfully completed.
   * @throws {InvalidTokenException} If the provided invitation token is invalid.
   * @throws {ExpiredTokenException} If the invitation token has expired.
   */
  async execute(data: SetupAdminPasswordRequestDto): Promise<{ email: string }> {
    const admin = await this.adminRepository.findByInvitationToken(data.token)

    if (!admin) {
      this.emitFailure(data, null, 'INVALID_TOKEN', 'Invalid invitation token')
      throw new InvalidTokenException()
    }

    if (admin.invitationExpiresAt && admin.invitationExpiresAt < DateTime.now()) {
      this.emitFailure(data, admin.id, 'EXPIRED_TOKEN', 'Expired invitation token')
      throw new ExpiredTokenException()
    }

    admin.password = data.password
    admin.invitationToken = null
    admin.invitationExpiresAt = null
    await this.adminRepository.save(admin)

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'ADMIN_PASSWORD_SETUP',
        actorId: String(admin.id),
        actorType: 'Admin',
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
        metadata: { email: admin.email },
      })
      .catch(() => {})

    // Block at the dispatch boundary too — without this, an admin locked by
    // the verify-side OTP guard could keep regenerating setup OTPs.
    await this.otpAttemptGuard.assertNotBlocked(admin.email)

    await this.otpSendingService.send(admin.email, admin.id.toString(), new AdminSetupOtpTemplate())
    return { email: admin.email }
  }

  private emitFailure(
    data: SetupAdminPasswordRequestDto,
    adminId: number | null,
    errorCode: string,
    errorMessage: string
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'ADMIN_PASSWORD_SETUP_FAILED',
        actorId: adminId !== null ? String(adminId) : null,
        actorType: 'Admin',
        targetType: 'Member',
        targetId: adminId !== null ? String(adminId) : null,
        result: AuditResult.FAILURE,
        errorCode,
        errorMessage,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
      })
      .catch(() => {})
  }
}
