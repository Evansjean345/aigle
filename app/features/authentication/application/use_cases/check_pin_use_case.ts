import { inject } from '@adonisjs/core'
import { LoginRequestDto } from '#features/authentication/application/dtos/login.dto'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'
import hash from '@adonisjs/core/services/hash'
import InvalidPincodeException from '#features/authentication/infrastructure/exceptions/invalid_pincode_exception'

@inject()
export default class CheckPinUseCase {
  /**
   * Constructs an instance of the class with the provided UserRepository.
   *
   * @param {UserRepository} userRepository - The repository used for user data management.
   */
  constructor(private userRepository: UserRepository) {}

  /**
   * Executes the authentication check for the provided login request data.
   *
   * @param {LoginRequestDto} data - The login request data containing user credentials or pin code.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating the success or failure of the authentication.
   */
  async execute(data: Pick<LoginRequestDto, 'phone' | 'pincode'>): Promise<boolean> {
    const user = await this.userRepository.findByPhone(data.phone)

    if (!user) {
      throw new UserAccountNotFoundException()
    }

    if (!(await hash.verify(user.pincode, data.pincode))) {
      throw new InvalidPincodeException()
    }

    return true
  }
}
