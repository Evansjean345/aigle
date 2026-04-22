import { inject } from '@adonisjs/core'
import AdminAuthService from '#features/authentication/application/services/admin/admin_auth_service'
import {
  AdminLoginRequestDto,
  AdminLoginResponseDto,
} from '#features/authentication/application/dtos/admin/admin_login.dto'
export interface Token {
  type: 'bearer'
  value: string
  expiresAt?: string
}

@inject()
export default class AdminLoginUseCase {
  /**
   * Creates an instance of the class with dependencies injected.
   *
   * @param {AdminAuthService} adminAuthService - The service responsible for admin authentication and authorization.
   */
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * Authenticates an admin user by verifying their credentials and generates access and refresh tokens.
   *
   * @param {AdminLoginRequestDto} data - The data containing the admin credentials (email and password).
   * @param {string} ip - The IP address of the client making the request.
   * @return {Promise<AdminLoginResponseDto>} A promise that resolves to the response containing the admin details and authentication tokens.
   */
  async execute(data: AdminLoginRequestDto, ip: string): Promise<AdminLoginResponseDto> {
    const { admin, tokens } = await this.adminAuthService.login(data.email, data.password, ip)

    return AdminLoginResponseDto.fromAdmin(
      admin,
      this.adminAuthService.formatToken(tokens.access),
      this.adminAuthService.formatToken(tokens.refresh)
    )
  }
}
