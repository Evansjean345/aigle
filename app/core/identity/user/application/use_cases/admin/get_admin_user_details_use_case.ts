import { inject } from '@adonisjs/core'
import { AdminUserDetailsResponseDto } from '#core/identity/user/application/dtos/admin/user_details.response.dto'
import User from '#core/identity/user/domain/models/user'

@inject()
export default class GetAdminUserDetailsUseCase {
  constructor() {}

  /**
   * Executes the use case to retrieve detailed user information for the admin space.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<AdminUserDetailsResponseDto | null>}
   */
  async execute(userId: string): Promise<AdminUserDetailsResponseDto | null> {
    const user = await User.query()
      .where('usersUid', userId)
      .preload('country')
      .preload('debitPhones', (query) => {
        query.preload('provider')
      })
      .preload('userDevices', (query) => {
        query.whereNull('unlinkedAt').preload('device')
      })
      .preload('keyLevel')
      .first()

    if (!user) {
      return null
    }

    return AdminUserDetailsResponseDto.fromUser(user)
  }
}
