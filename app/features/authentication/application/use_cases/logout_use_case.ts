import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import LogoutException from '#features/authentication/infrastructure/exceptions/logout_exception'

/**
 * Handles the use case for logging out an authenticated user.
 */
@inject()
export default class LogoutUseCase {
  /**
   * Executes the logout process by invalidating the current access token
   * of the authenticated user.
   *
   * @param {any} authenticatedUser - The authenticated user whose access token will be invalidated.
   * @return {Promise<boolean>} Returns a promise that resolves to `true` if the logout process is successful.
   * @throws {LogoutException} Throws if an error occurs while attempting to invalidate the access token.
   */
  async execute(authenticatedUser: any): Promise<boolean> {
    try {
      await User.accessTokens.delete(
        authenticatedUser as User,
        authenticatedUser.currentAccessToken.identifier
      )

      return true
    } catch (error) {
      throw new LogoutException()
    }
  }
}
