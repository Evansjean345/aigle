import AuthentificationService from '#features/authentication/application/services/mobile_auth_service'
import OtpService from '#features/authentication/application/services/otp_service'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#features/users/domain/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#features/authentication/application/dtos/authenticated_profile.response.dto'
import { toAuthenticatedUserProfileAndTokenResponse } from '#features/authentication/application/mappers/authenticated_user.mapper'
import { inject } from '@adonisjs/core'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import env from '#start/env'

@inject()
export default class VerifyAndAuthenticateUserAccountUseCase {
  /**
   * Initializes a new instance of the class with the specified dependencies.
   *
   * @param {AuthentificationService} authService - The authentication service used for managing authentication-related operations.
   * @param {OtpService} otpService - The service used for managing one-time password (OTP) functionalities.
   * @param {CountryRepository} countryRepository - The repository used for accessing and managing country-related data.
   */
  constructor(
    private readonly authService: AuthentificationService,
    private readonly otpService: OtpService,
    private readonly countryRepository: CountryRepository
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
      country_id: number
    },
    type: 'register' | 'reset' | 'login'
  ): Promise<AuthenticatedProfileAndTokenResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', payload.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, payload.phone)
    const user = await this.authService.checkPhoneNumber(formattedPhone)

    if (!user) {
      throw new Exception("Ce numéro de téléphone n'existe pas", {
        status: 400,
        code: 'PHONE_NOT_FOUND',
      })
    }

    const bypassEnabled = env.get('APPLE_BYPASS_ENABLED') as boolean
    const applePhone = env.get('APPLE_REVIEW_PHONE') as string | undefined

    try {
      const shouldBypass = bypassEnabled && applePhone && user.phone === applePhone

      if (!shouldBypass) {
        await this.otpService.verifyOtp({ phone: user.phone, enteredOtp: payload.otp })
      }

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
