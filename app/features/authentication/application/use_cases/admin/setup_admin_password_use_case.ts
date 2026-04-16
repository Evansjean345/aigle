import { inject } from '@adonisjs/core'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import InvalidTokenException from '#features/team/infrastructure/exceptions/invalid_token_exception'
import ExpiredTokenException from '#features/team/infrastructure/exceptions/expired_token_exception'
import OtpSendingService from '#features/otp/application/services/otp_sending_service'
import { SetupAdminPasswordRequestDto } from '#features/authentication/application/dtos/admin/setup_admin_password.dto'
import { DateTime } from 'luxon'
import AdminSetupOtpTemplate from '#features/otp/infrastructure/templates/admin_setup_otp_template'

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
    private readonly otpSendingService: OtpSendingService
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
      throw new InvalidTokenException()
    }

    if (admin.invitationExpiresAt && admin.invitationExpiresAt < DateTime.now()) {
      throw new ExpiredTokenException()
    }

    admin.password = data.password
    admin.invitationToken = null
    admin.invitationExpiresAt = null
    await this.adminRepository.save(admin)

    await this.otpSendingService.send(admin.email, admin.id.toString(), new AdminSetupOtpTemplate())
    return { email: admin.email }
  }
}
