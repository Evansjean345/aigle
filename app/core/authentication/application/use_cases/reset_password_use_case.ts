import { inject } from '@adonisjs/core'
import { ResetPasswordRequestDto } from '#core/authentication/application/dtos/reset_password.dto'
import CountryRepository from '#core/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#core/authentication/infrastructure/exceptions/user_account_not_found_exception'
import ResetPasswordTokenProvider from '#core/authentication/domain/interfaces/reset_password_token_provider'
import InvalidResetTokenException from '#core/authentication/infrastructure/exceptions/invalid_reset_token_exception'
import User from '#core/user/domain/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#core/authentication/application/dtos/profile.dto'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class ResetPasswordUseCase {
  /**
   * Constructs an instance of the class with the provided dependencies.
   *
   * @param {UserRepository} userRepository - The repository responsible for managing user data.
   * @param {CountryRepository} countryRepository - The repository responsible for managing country data.
   * @param {ResetPasswordTokenProvider} resetPasswordTokenProvider - The provider responsible for handling reset password tokens.
   */
  constructor(
    protected userRepository: UserRepository,
    protected countryRepository: CountryRepository,
    protected resetPasswordTokenProvider: ResetPasswordTokenProvider
  ) {}

  /**
   * Executes the reset password operation.
   *
   * @param {ResetPasswordRequestDto} data - The data required to reset the user's password, including the user's phone number, reset token, and new pincode.
   * @return {Promise<AuthenticatedProfileAndTokenResponseDto>} A promise that resolves to an object containing the authenticated user's profile and a new access token.
   * @throws {UserAccountNotFoundException} If no user is found with the provided phone number.
   * @throws {InvalidResetTokenException} If the provided reset token is invalid.
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

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'PASSWORD_RESET',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
        metadata: {
          geoCountry: data.geoLocation?.countryCode ?? null,
          geoCity: data.geoLocation?.city ?? null,
          isVpn: data.geoLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})

    return AuthenticatedProfileAndTokenResponseDto.from(user, token.value!.release())
  }
}
