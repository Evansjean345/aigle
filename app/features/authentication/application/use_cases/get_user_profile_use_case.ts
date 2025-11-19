import { inject } from '@adonisjs/core'
import User from '#features/users/domain/models/user'

@inject()
export default class GetUserProfileUseCase {
  /**
   * Executes the process of loading related data (wallet, country, and document) for the given authenticated user.
   *
   * @param {User} authenticated - The user object that is authenticated and should have related data loaded.
   * @return {Promise<User>} A promise that resolves to the authenticated user object with the related data loaded.
   */
  async execute(authenticated: User): Promise<User> {
    await authenticated.load('country')
    return authenticated
  }
}
