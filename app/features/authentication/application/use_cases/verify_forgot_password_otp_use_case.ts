import { inject } from '@adonisjs/core'
import OtpVerificationService from '#features/otp/application/services/otp_verification_service'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import ResetPasswordTokenProvider from '#features/authentication/domain/interfaces/reset_password_token_provider'
import { VerifyAccountRequestDto } from '#features/authentication/application/dtos/verify_account.dto'
import { concartPhoneNumber } from '#shared/utils/utiles'
import PhoneNotFoundException from '#features/authentication/infrastructure/exceptions/phone_not_found_exception'
import { randomUUID } from 'node:crypto'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import User from '#features/user/domain/models/user'

@inject()
export default class VerifyForgotPasswordOtpUseCase {
  /**
   * Constructs an instance of the class with the required dependencies.
   *
   * @param {UserRepository} userRepository - The repository used for managing user data.
   * @param otpVerificationService
   * @param {CountryRepository} countryRepository - The repository used for accessing country-specific data.
   * @param {ResetPasswordTokenProvider} resetPasswordTokenProvider - The provider used for managing reset password tokens.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpVerificationService: OtpVerificationService,
    private readonly countryRepository: CountryRepository,
    private readonly resetPasswordTokenProvider: ResetPasswordTokenProvider
  ) {}

  /**
   * Executes the account verification process. It validates the provided phone number
   * and OTP, generates a reset token, and stores it with a time-to-live (TTL).
   *
   * @param {VerifyAccountRequestDto} payload - The data required for verification,
   * including country ID, phone number, and OTP.
   * @returns {Promise<{ reset_token: string }>} A promise resolving with an object
   * containing the generated reset token.
   * @throws {PhoneNotFoundException} If the phone number does not belong to any user.
   */
  async execute(payload: VerifyAccountRequestDto): Promise<{ reset_token: string }> {
    const country = await this.countryRepository.findCountryBy('id', payload.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, payload.phone)
    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    if (!this.shouldBypassOtpVerification(user)) {
      await this.otpVerificationService.verify({ identifier: user.phone, enteredOtp: payload.otp })
    }

    const resetToken = randomUUID()
    await this.resetPasswordTokenProvider.store(user.phone, resetToken, 600) // 10 seconds TTL

    return { reset_token: resetToken }
  }

  /**
   * Determines if the OTP verification should be bypassed for the given user.
   *
   * @param {User} user - The user object containing relevant information about the user.
   * @return {boolean} Returns `true` if OTP verification should be bypassed; otherwise, `false`.
   */
  private shouldBypassOtpVerification(user: User): boolean {
    return Boolean(bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview)
  }
}
