import { inject } from '@adonisjs/core'
import LoginRequestDto from '#mobile/authentication/dtos/login_request.dto'
import AuthentificationService from '#mobile/authentication/services/mobile_auth_service'
import { LoginResult } from '#mobile/authentication/dtos/login.result'
import OtpService from '#shared/services/otp_service'

@inject()
export default class LoginUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {AuthentificationService} authServices - The authentication service used for managing authentication tasks.
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
      await this.otpService.sendOtp(user.phone, user.usersUid)
      return { message: 'OTP sent successfully' }
    } catch (error) {
      throw error
    }
  }
}
