import { inject } from '@adonisjs/core'
import Admin from '#features/team/domain/models/admin'
import AdminAuthService from '#features/authentication/application/services/admin/admin_auth_service'
import {
  AdminRefreshTokenRequestDto,
  AdminRefreshTokenResponseDto,
} from '#features/authentication/application/dtos/admin/admin_login.dto'
import { toAdminRefreshTokenResponse } from '#features/authentication/application/mappers/admin/admin_auth.mapper'
import { Secret } from '@adonisjs/core/helpers'
import InvalidRefreshTokenException from '#features/authentication/infrastructure/exceptions/invalid_refresh_token_exception'
import { DateTime } from 'luxon'

@inject()
export default class AdminRefreshTokenUseCase {
  /**
   * Creates an instance of the class with the given admin authentication service.
   *
   * @param {AdminAuthService} adminAuthService - The service responsible for handling administrative authentication.
   */
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * Executes the refresh token process for an administrator.
   *
   * @param {AdminRefreshTokenRequestDto} data - The request data containing the administrator's refresh token.
   * @param {string} ip - The IP address of the client making the request.
   * @return {Promise<AdminRefreshTokenResponseDto>} A promise that resolves with the newly generated access and refresh tokens.
   * @throws {InvalidRefreshTokenException} Throws an exception if the provided refresh token is invalid.
   */
  async execute(
    data: AdminRefreshTokenRequestDto,
    ip: string
  ): Promise<AdminRefreshTokenResponseDto> {
    const existingToken = await Admin.refreshToken.verify(new Secret(data.refresh_token))

    if (!existingToken) {
      throw new InvalidRefreshTokenException()
    }

    const admin = await Admin.findOrFail(existingToken.tokenableId)

    const [, { access, refresh }] = await Promise.all([
      Admin.refreshToken.delete(admin, existingToken.identifier),
      this.adminAuthService.generateTokens(admin),
    ])

    admin.lastLoginIp = ip
    admin.lastLoginAt = DateTime.now()
    await admin.save()

    return toAdminRefreshTokenResponse(
      this.adminAuthService.formatToken(access),
      this.adminAuthService.formatToken(refresh)
    )
  }
}
