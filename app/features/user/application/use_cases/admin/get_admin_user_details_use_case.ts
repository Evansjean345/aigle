import { inject } from '@adonisjs/core'
import { AdminUserDetailsResponseDto } from '#features/user/application/dtos/admin/user_details.response.dto'
import User from '#features/user/domain/models/user'
import { mapUserToAdminDetailsDto } from '#features/user/application/mappers/admin/users.mapper'

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
      .preload('devices')
      .preload('keyLevel')
      .first()

    if (!user) {
      return null
    }

    return mapUserToAdminDetailsDto(user)
  }
}
