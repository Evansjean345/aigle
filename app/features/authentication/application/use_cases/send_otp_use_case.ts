import { inject } from '@adonisjs/core'
import OtpSendingService from '#features/otp/application/services/otp_sending_service'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { OtpRequestDto, OtpResponseDto } from '#features/authentication/application/dtos/otp.dto'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import PhoneNotFoundException from '#features/authentication/infrastructure/exceptions/phone_not_found_exception'

/**
 * This class is responsible for handling the use case of sending an OTP (One-Time Password) to a user's phone number.
 */
@inject()
export default class SendOtpUseCase {
  /**
   * Constructs an instance of the class with the provided dependencies.
   *
   * @param {UserRepository} userRepository - The repository for user data management.
   * @param otpSendingService
   * @param {CountryRepository} countryRepository - The repository for managing country-related data.
   */
  constructor(
    protected userRepository: UserRepository,
    protected otpSendingService: OtpSendingService,
    protected countryRepository: CountryRepository
  ) {}

  /**
   * Executes the process of sending an OTP (One-Time Password) to a user based on the provided data.
   *
   * @param {OtpRequestDto} data - The data required to send an OTP, including the user's phone number.
   * @return {Promise<{ message: string }>} A promise that resolves to an object indicating whether the OTP was successfully sent.
   * @throws {PhoneNotFoundException} Throws an exception if no account is associated with the provided phone number or if an error occurs during the OTP sending process.
   */
  async execute(data: OtpRequestDto): Promise<OtpResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)
    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException('Numéro de téléphone introuvable')
    }

    const response = await this.otpSendingService.send(user.phone, user.usersUid)

    if (!response.sent) {
      return {
        message: `Veuillez patienter ${response.waitTime} secondes avant de renvoyer un code OTP.`,
        sent: false,
        waitTime: response.waitTime,
      }
    }

    return { message: 'Code OTP envoyé avec succès', sent: true }
  }
}
