import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import UserRepository from 'app/features/user/domain/interfaces/user_repository.js'
import { Exception } from '@adonisjs/core/exceptions'
import { ChangePinCodeDTO } from '#mobile/profile/dtos/change_pin_code.dto'

/**
 * Class representing the use case for changing a user's password.
 */
@inject()
export default class ChangePinCodeUseCase {
  /**
   * Constructor for the class that initializes the user repository.
   *
   * @param {UserRepository} userRepository - The repository for managing user data
   */
  constructor(private userRepository: UserRepository) {}

  /**
   * This method handles the password change operation for a user. It verifies the current pincode,
   * ensures the new pincode is different, updates the user's pincode, and optionally revokes the
   * current access token for enhanced security.
   *
   * @param {ChangePinCodeDTO} input - The input object containing user details, old pincode,
   * and the new pincode.
   * @param {Object} input.user - The user object containing user data.
   * @param {string} input.user.phone - The phone number of the user.
   * @param {string} input.oldPincode - The current pincode to be verified.
   * @param {string} input.newPincode - The new pincode to be set.
   *
   * @return {Promise<{ success: boolean }>} - Returns a promise resolving to an object indicating
   * the success of the password change operation.
   * @throws {Exception} - Throws an exception if the user is not found, the old pincode is invalid,
   * or the new pincode is the same as the old pincode.
   */
  async execute(input: ChangePinCodeDTO): Promise<{ success: boolean }> {
    const user = await this.userRepository.findByPhone(input.user.phone)

    if (!user) {
      throw new Exception('Utilisateur introuvable', { status: 404, code: 'USER_NOT_FOUND' })
    }

    const isValid = await hash.verify(user.pincode, input.oldPincode)

    if (!isValid) {
      throw new Exception('Ancien code pin invalide', { status: 400, code: 'INVALID_OLD_PIN' })
    }

    if (input.newPincode === input.oldPincode) {
      throw new Exception('Le nouveau code pin est identique au code actuel', {
        status: 400,
        code: 'NEW_PIN_SAME_AS_OLD',
      })
    }

    user.pincode = input.newPincode
    await this.userRepository.save(user)

    // Optionally revoke current token for security (keep user logged in on next login)
    // try {
    //   if ((input.user as any).currentAccessToken?.identifier) {
    //     await User.accessTokens.delete(
    //       user as User,
    //       (input.user as any).currentAccessToken.identifier
    //     )
    //   }
    // } catch (_) {
    //   // Ignore token revoke errors to avoid blocking password change
    // }

    return { success: true }
  }
}
