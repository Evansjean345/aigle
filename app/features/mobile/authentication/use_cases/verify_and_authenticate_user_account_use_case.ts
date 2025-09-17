import AuthentificationService from '#mobile/authentication/services/mobile_auth_service'
import OtpService from '#shared/services/otp_service'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#shared/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#mobile/authentication/dtos/authenticated_profile.response.dto'
import { toAuthenticatedUserProfileAndTokenResponse } from '#mobile/authentication/mappers/authenticated_user.mapper'
import { inject } from '@adonisjs/core'

@inject()
export default class VerifyAndAuthenticateUserAccountUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AuthentificationService} authService - The authentication service used for handling user authentication.
   * @param {OtpService} otpService - The service used for generating and validating one-time passwords (OTPs).
   */
  constructor(
    private readonly authService: AuthentificationService,
    private readonly otpService: OtpService
  ) {}

  /**
   * Executes the OTP verification process by validating the provided phone number and PIN code.
   *
   * @param {Object} payload - The input data required for OTP verification.
   * @param type
   * @param {string} payload.phone - The phone number to be verified.
   * @param {string} payload.pincode - The OTP entered by the user for verification.
   * @return {Promise<void>} A promise that resolves when the OTP verification process completes successfully or rejects in case of an error.
   */
  async execute(
    payload: {
      phone: string
      otp: string
    },
    type: 'register' | 'reset' | 'login'
  ): Promise<AuthenticatedProfileAndTokenResponseDto> {
    const user = await this.authService.checkPhoneNumber(payload.phone)

    if (!user) {
      throw new Exception('Phone number not found', {
        status: 404,
        code: 'PHONE_NOT_FOUND',
      })
    }

    try {
      await this.otpService.verifyOtp({ phone: user.phone, enteredOtp: payload.otp })

      if (type === 'register' && user.status === 'inactive') {
        await this.authService.updateUserAccountStatus(user, 'active')
      }

      const token = await User.accessTokens.create(user)

      await user.load('country')
      await user.load('wallet')

      return toAuthenticatedUserProfileAndTokenResponse(user, token.value!.release())
    } catch (error) {
      throw error
    }
  }
}
