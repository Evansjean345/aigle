import { inject } from '@adonisjs/core'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import OtpService from '#features/authentication/application/services/otp_service'
import AdminAuthService from '#features/authentication/application/services/admin/admin_auth_service'
import { toAdminLoginResponse } from '#features/authentication/application/mappers/admin/admin_auth.mapper'
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
  constructor(
    private adminRepository: AdminRepository,
    private otpService: OtpService,
    private adminAuthService: AdminAuthService
  ) {}

  async execute(data: VerifyAdminOtpRequestDto): Promise<AdminLoginResponseDto> {
    const admin = await this.adminRepository.findByEmail(data.email)
    if (!admin) {
      throw new AdminNotFoundException()
    }

    await this.otpService.verifyOtp({ identifier: admin.email, enteredOtp: data.otp })

    admin.isActive = true
    admin.invitationToken = null
    admin.invitationExpiresAt = null
    await this.adminRepository.save(admin)

    await admin.load('role')
    await emitter.emit('activity:audit', {
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

    const tokens = await this.adminAuthService.generateTokens(admin)

    // Recharger les relations pour le mapper
    await admin.load('role', (query) => {
      query.preload('permissions')
    })

    return toAdminLoginResponse(
      admin,
      this.adminAuthService.formatToken(tokens.access),
      this.adminAuthService.formatToken(tokens.refresh)
    )
  }
}
