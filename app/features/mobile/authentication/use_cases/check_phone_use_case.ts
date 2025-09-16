import { inject } from '@adonisjs/core'
import AuthentificationService from '#mobile/authentication/services/mobile_auth_service'
import { Exception } from '@adonisjs/core/exceptions'
import CheckPhoneResponseDto from '#mobile/authentication/dtos/check_phone.response.dto'

@inject()
export default class CheckPhoneUseCase {
  /**
   * Constructs an instance of the class by initializing the required services.
   *
   * @param {AuthentificationService} authenticationService - Service for handling authentication operations.
   * @param {OtpService} otpService - Service for handling one-time password (OTP) operations.
   */
  constructor(
    private authenticationService: AuthentificationService,
  ) {}

  /**
   * Executes the process of checking a phone number and sending an OTP to the user associated with it.
   *
   * @param {string} payload - The phone number to be validated and used for sending an OTP.
   * @return {Promise<CheckPhoneResponseDto>} A promise that resolves to an object containing a success message and the phone number.
   * @throws {Exception} Throws an exception if the phone number is not found or an error occurs while sending the OTP.
   */
  async execute(payload: string): Promise<CheckPhoneResponseDto> {
    const user = await this.authenticationService.checkPhoneNumber(payload)

    if (!user) {
      throw new Exception('Phone number not found', {
        status: 404,
        code: 'PHONE_NOT_FOUND',
      })
    }
    
    return {
      message: "phone exists",
      phone: payload
    }
  }
}
