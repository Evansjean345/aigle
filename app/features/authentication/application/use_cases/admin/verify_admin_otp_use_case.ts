import { inject } from '@adonisjs/core'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import OtpVerificationService from '#features/otp/application/services/otp_verification_service'
import AdminAuthService from '#features/authentication/application/services/admin/admin_auth_service'
import { AdminLoginResponseDto } from '#features/authentication/application/dtos/admin/admin_login.dto'
import AdminNotFoundException from '#features/team/infrastructure/exceptions/admin_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'

import { AuditResult } from '#features/audit/domain/enums'

export interface VerifyAdminOtpRequestDto {
  email: string
  otp: string
}

@inject()
export default class VerifyAdminOtpUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository used to manage admin data.
   * @param {OtpVerificationService} otpVerificationService - The service used for verifying one-time passwords.
   * @param {AdminAuthService} adminAuthService - The service used for managing admin authentication.
   */
  constructor(
    private adminRepository: AdminRepository,
    private otpVerificationService: OtpVerificationService,
    private adminAuthService: AdminAuthService
  ) {}

  /**
   * Executes the OTP verification process for an admin and generates authentication tokens upon success.
   *
   * @param {VerifyAdminOtpRequestDto} data - The data object containing the admin's email and the OTP entered for verification.
   * @return {Promise<AdminLoginResponseDto>} A promise that resolves with an AdminLoginResponseDto containing the admin's information and authentication tokens.
   * @throws {AdminNotFoundException} If no admin exists with the provided email.
   */
  async execute(data: VerifyAdminOtpRequestDto): Promise<AdminLoginResponseDto> {
    const admin = await this.adminRepository.findByEmail(data.email)
    if (!admin) {
      throw new AdminNotFoundException()
    }

    await this.otpVerificationService.verify({ identifier: admin.email, enteredOtp: data.otp })

    admin.isActive = true
    admin.invitationToken = null
    admin.invitationExpiresAt = null
    await this.adminRepository.save(admin)

    await admin.load('role')

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'OTP_VERIFIED',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role.name,
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        metadata: { email: admin.email },
      })
      .catch(() => {})

    const tokens = await this.adminAuthService.generateTokens(admin)

    // Recharger les relations pour le mapper
    await admin.load('role', (query) => {
      query.preload('permissions')
    })

    return AdminLoginResponseDto.fromAdmin(
      admin,
      this.adminAuthService.formatToken(tokens.access),
      this.adminAuthService.formatToken(tokens.refresh)
    )
  }
}
