import { inject } from '@adonisjs/core'
import { ResetPasswordRequestDto } from '#features/authentication/application/dtos/reset_password.dto'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'
import ResetPasswordTokenProvider from '#features/authentication/domain/interfaces/reset_password_token_provider'
import InvalidResetTokenException from '#features/authentication/infrastructure/exceptions/invalid_reset_token_exception'
import User from '#features/user/domain/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#features/authentication/application/dtos/profile.dto'

@inject()
export default class ResetPasswordUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {UserRepository} userRepository - The repository used for user data operations.
   * @param {CountryRepository} countryRepository - The repository used for country data operations.
   * @param {ResetPasswordTokenProvider} resetPasswordTokenProvider - The provider responsible for generating and managing reset password tokens.
   */
  constructor(
    protected userRepository: UserRepository,
    protected countryRepository: CountryRepository,
    protected resetPasswordTokenProvider: ResetPasswordTokenProvider
  ) {}

  /**
   * Executes the reset password process for a user. Validates the reset token, updates the user's pincode,
   * and generates an authentication token upon successful completion.
   *
   * @param {ResetPasswordRequestDto} data - The DTO containing reset password request details, including country ID, phone number, reset token, and new pincode.
   * @return {Promise<AuthenticatedProfileAndTokenResponseDto>} A promise resolving to an object containing the authenticated user's profile and a token.
   * @throws {UserAccountNotFoundException} If no user is found with the provided phone number.
   * @throws {InvalidResetTokenException} If the reset token provided is invalid.
   */
  async execute(data: ResetPasswordRequestDto): Promise<AuthenticatedProfileAndTokenResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const isValidToken = await this.resetPasswordTokenProvider.verify(user.phone, data.reset_token)

    if (!isValidToken) {
      throw new InvalidResetTokenException()
    }

    user.pincode = data.new_pincode
    await this.userRepository.save(user)
    await this.resetPasswordTokenProvider.delete(user.phone)

    const token = await User.accessTokens.create(user)
    await user.load('country')
    await user.load('wallet')
    await user.load('kycDocument')

    return AuthenticatedProfileAndTokenResponseDto.from(user, token.value!.release())
  }
}
