import { inject } from '@adonisjs/core'
import AuthentificationService from '#features/authentication/application/services/mobile_auth_service'
import LoginRequestDto from '#features/authentication/application/dto/login_request.dto'

@inject()
export default class CheckPinUseCase {
  /**
   * Constructs an instance of the class with the provided AuthenticationService.
   *
   * @param {AuthentificationService} authService - The authentication service used for handling authentication-related operations.
   */
  constructor(private authService: AuthentificationService) {}

  /**
   * Executes the authentication check for the provided login request data.
   *
   * @param {LoginRequestDto} data - The login request data containing user credentials or pin code.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success or failure of the authentication.
   */
  async execute(data: Pick<LoginRequestDto, 'phone' | 'pincode'>): Promise<boolean> {
    return await this.authService.checkCodePin(data)
  }
}
