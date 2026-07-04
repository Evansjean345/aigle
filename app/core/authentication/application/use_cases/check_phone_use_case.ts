import { inject } from '@adonisjs/core'
import { CheckPhoneResponseDto } from '#core/authentication/application/dtos/check_phone.dto'
import CountryRepository from '#core/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import PhoneNotFoundException from '#core/authentication/infrastructure/exceptions/phone_not_found_exception'
import UserRepository from '#core/user/domain/interfaces/user_repository'

/**
 * Use case class to handle the logic for checking the validity of a phone number
 * and sending an OTP to the associated user. This class interacts with authentication
 * and country management services to perform its operations.
 */
@inject()
export default class CheckPhoneUseCase {
  /**
   * Constructs an instance of the class with dependencies for authentication and country data management.
   *
   * @param {UserRepository} userRepository - The repository used for user data management.
   * @param {CountryRepository} countryRepository - The repository used for accessing and managing country data.
   */
  constructor(
    private userRepository: UserRepository,
    private readonly countryRepository: CountryRepository
  ) {}

  /**
   * Verifies if a given phone number exists in the system by formatting it with the country's phone code
   * and checking its validity.
   *
   * @param {string} phoneNumber - The phone number provided by the user.
   * @param {number} countryId - The unique identifier of the country associated with the phone number.
   * @return {Promise<CheckPhoneResponseDto>} A promise resolving to a response object containing a message and the formatted phone number. Throws an exception if the phone number does not exist.
   */
  async execute(phoneNumber: string, countryId: number): Promise<CheckPhoneResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', countryId)
    const formattedPhone = concartPhoneNumber(country.phoneCode, phoneNumber)

    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException('Numéro de téléphone introuvable')
    }

    return {
      message: 'phone exists',
      phone: formattedPhone,
    }
  }
}
