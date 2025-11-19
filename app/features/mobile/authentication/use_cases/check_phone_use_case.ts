import { inject } from '@adonisjs/core'
import AuthentificationService from '#mobile/authentication/services/mobile_auth_service'
import { Exception } from '@adonisjs/core/exceptions'
import CheckPhoneResponseDto from '#mobile/authentication/dtos/check_phone.response.dto'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/kernel/utils/utiles'

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
   * @param {AuthentificationService} authenticationService - The service used for handling authentication operations.
   * @param {CountryRepository} countryRepository - The repository used for accessing and managing country data.
   */
  constructor(
    private authenticationService: AuthentificationService,
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

    console.log(formattedPhone)

    const user = await this.authenticationService.checkPhoneNumber(formattedPhone)

    if (!user) {
      throw new Exception('Numéro de téléphone introuvable', {
        status: 404,
        code: 'PHONE_NOT_FOUND',
      })
    }

    return {
      message: 'phone exists',
      phone: formattedPhone,
    }
  }
}
