import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminLoginUseCase from '#core/team/authentication/application/use_cases/admin_login_use_case'
import AdminRefreshTokenUseCase from '#core/team/authentication/application/use_cases/admin_refresh_token_use_case'
import SetupAdminPasswordUseCase from '#core/team/authentication/application/use_cases/setup_admin_password_use_case'
import VerifyAdminOtpUseCase from '#core/team/authentication/application/use_cases/verify_admin_otp_use_case'
import {
  adminLoginValidator,
  adminRefreshTokenValidator,
  setupAdminPasswordValidator,
  verifyAdminOtpValidator,
} from '#core/team/authentication/presentation/validators/admin_validator'

@inject()
export default class AdminManagementController {
  /**
   * Constructs an instance of the class with the necessary use case dependencies.
   *
   * @param {AdminLoginUseCase} adminLoginUseCase - The use case responsible for the admin login process.
   * @param {AdminRefreshTokenUseCase} adminRefreshTokenUseCase
   * @param {SetupAdminPasswordUseCase} setupAdminPasswordUseCase
   * @param {VerifyAdminOtpUseCase} verifyAdminOtpUseCase
   */
  constructor(
    private adminLoginUseCase: AdminLoginUseCase,
    private adminRefreshTokenUseCase: AdminRefreshTokenUseCase,
    private setupAdminPasswordUseCase: SetupAdminPasswordUseCase,
    private verifyAdminOtpUseCase: VerifyAdminOtpUseCase
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

  /**
   * Sets up the administrator password based on the provided request payload.
   *
   * @param {Object} HttpContext - The HTTP context containing the request and response objects.
   * @param {Object} HttpContext.request - The request object containing the input payload.
   * @param {Object} HttpContext.response - The response object used to send the output.
   * @return {Promise<void>} A promise that resolves when the password setup process is completed.
   */
  async setupPassword({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(setupAdminPasswordValidator)
    const data = await this.setupAdminPasswordUseCase.execute({
      ...payload,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })
    return response.ok(data)
  }

  /**
   * Verifies the OTP provided in the request using the specified validator and use case logic,
   * then sends an appropriate response with the result.
   *
   * @param {Object} context - The HTTP context object containing the request and response.
   * @param {Object} context.request - The HTTP request object, which should include the OTP to be verified.
   * @param {Object} context.response - The HTTP response object used to send the result back to the client.
   *
   * @return {Promise<void>} A promise that resolves when the response has been sent.
   */
  async verifyOtp({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(verifyAdminOtpValidator)
    const result = await this.verifyAdminOtpUseCase.execute({
      ...data,
      ipAddress: request.ip(),
    })
    return response.ok(result)
  }
}
