import { inject } from '@adonisjs/core'
import OtpService from '#shared/services/otp_service'
import UserRepository from '#shared/interfaces/repositories/user_repository'
import { Exception } from '@adonisjs/core/exceptions'
import { OtpRequestDto, OtpResponseDto } from '#mobile/authentication/dtos/otp.dto'
import CountryRepository from '#shared/interfaces/repositories/country_repository'
import { concartPhoneNumber } from '../../../../helpers/utiles.js'

/**
 * This class is responsible for handling the use case of sending an OTP (One-Time Password) to a user's phone number.
 */
@inject()
export default class SendOtpUseCase {
  /**
   * Constructs an instance of the class with the provided dependencies.
   *
   * @param {UserRepository} userRepository - The repository for user data management.
   * @param {OtpService} otpService - The service responsible for handling OTP (One-Time Password) operations.
   * @param {CountryRepository} countryRepository - The repository for managing country-related data.
   */
  constructor(
    protected userRepository: UserRepository,
    protected otpService: OtpService,
    protected countryRepository: CountryRepository
  ) {}

  /**
   * Executes the process of sending an OTP (One-Time Password) to a user based on the provided data.
   *
   * @param {OtpRequestDto} data - The data required to send an OTP, including the user's phone number.
   * @return {Promise<{ message: string }>} A promise that resolves to an object indicating whether the OTP was successfully sent.
   * @throws {Exception} Throws an exception if no account is associated with the provided phone number or if an error occurs during the OTP sending process.
   */
  async execute(data: OtpRequestDto): Promise<OtpResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new Exception('Numéro de téléphone introuvable', {
        status: 400,
        code: 'PHONE_NOT_FOUND',
      })
    }

    try {
      await this.otpService.sendOtp(user.phone, user.usersUid)
      return { message: 'OTP Sent successfully' }
    } catch (error) {
      throw error
    }
  }
}
