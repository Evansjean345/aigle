import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminLoginUseCase from '#features/authentication/application/use_cases/admin/admin_login_use_case'
import AdminRefreshTokenUseCase from '#features/authentication/application/use_cases/admin/admin_refresh_token_use_case'
import {
  adminLoginValidator,
  adminRefreshTokenValidator,
} from '#features/authentication/presentation/admin/validators/admin_validator'

@inject()
export default class AdminManagementController {
  /**
   * Constructs an instance of the class with the necessary use case dependencies.
   *
   * @param {AdminLoginUseCase} adminLoginUseCase - The use case responsible for the admin login process.
   * @param {AdminRefreshTokenUseCase} adminRefreshTokenUseCase
   */
  constructor(
    private adminLoginUseCase: AdminLoginUseCase,
    private adminRefreshTokenUseCase: AdminRefreshTokenUseCase
  ) {}

  /**
   * Handles the login process for an admin user.
   *
   * @param {Object} context - The HTTP context object.
   * @param {import('@adonisjs/http-server/build/standalone').HttpContextContract} context.request - The HTTP request object.
   * @param {import('@adonisjs/http-server/build/standalone').HttpContextContract} context.response - The HTTP response object.
   * @return {Promise<void>} Returns a promise that resolves with no value when the response is successfully sent.
   */
  async login({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(adminLoginValidator)
    const ip = request.ip()

    const result = await this.adminLoginUseCase.execute(data, ip)
    return response.ok(result)
  }

  /**
   * Handles the refresh token process for an admin user.
   *
   * @param {HttpContext} context
   */
  async refresh({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(adminRefreshTokenValidator)
    const ip = request.ip()

    const result = await this.adminRefreshTokenUseCase.execute(data, ip)
    return response.ok(result)
  }
}
