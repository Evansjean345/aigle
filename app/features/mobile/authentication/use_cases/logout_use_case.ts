import AuthServices from '#services/auth_services'
import { inject } from '@adonisjs/core'
import User from '#shared/models/user'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Handles the use case for logging out an authenticated user.
 */
@inject()
export default class LogoutUseCase {
  /**
   * Constructs an instance of the class with the required dependencies.
   *
   * @param {AuthServices} authServices - The authentication services used to handle authentication-related operations.
   */
  constructor(protected authServices: AuthServices) {}

  /**
   * Executes the logout process for the authenticated user by deleting the current access token.
   *
   * @param {Object} authenticatedUser - The authenticated user object containing the current access token.
   * @param {AccessToken} authenticatedUser.currentAccessToken - The access token associated with the authenticated user.
   * @return {Promise<boolean>} A promise resolving to `true` if the logout process is successful, otherwise throws an exception.
   * @throws {Exception} Throws an exception if the logout process fails.
   */
  async execute(authenticatedUser: any): Promise<boolean> {
    try {
      await User.accessTokens.delete(
        authenticatedUser as User,
        authenticatedUser.currentAccessToken.identifier
      )

      return true
    } catch (error) {
      throw new Exception('Failed to logout', {
        status: 500,
        code: 'FAILED_TO_LOGOUT',
      })
    }
  }
}
