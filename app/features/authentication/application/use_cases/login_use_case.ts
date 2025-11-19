import { inject } from '@adonisjs/core'
import LoginRequestDto from '#features/authentication/application/dtos/login_request.dto'
import AuthentificationService from '#features/authentication/application/services/mobile_auth_service'
import { LoginResult } from '#features/authentication/application/dtos/login.result'
import OtpService from '#features/authentication/application/services/otp_service'

import env from '#start/env'

@inject()
export default class LoginUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {AuthentificationService} authServices - The authentication service used for managing authentication processes.
   * @param {OtpService} otpService - The OTP (One-Time Password) service used for handling OTP-related functionalities.
   */
  constructor(
    protected authServices: AuthentificationService,
    private otpService: OtpService
  ) {}

  /**
   * Executes the login process by delegating to the authentication service.
   *
   * @param {LoginRequestDto} data - The login request data containing credentials.
   * @return {Promise<any>} A promise that resolves to the result of the login operation.
   */
  async execute(data: LoginRequestDto): Promise<LoginResult> {
    try {
      const user = await this.authServices.login(data)

      const bypassEnabled = env.get('APPLE_BYPASS_ENABLED') as boolean
      const applePhone = env.get('APPLE_REVIEW_PHONE') as string | undefined

      if (bypassEnabled && applePhone && user.phone === applePhone) {
        return { message: 'Bypass OTP activé pour ce numéro' }
      }

      await this.otpService.sendOtp(user.phone, user.usersUid)
      return { message: 'OTP sent successfully' }
    } catch (error) {
      throw error
    }
  }
}
