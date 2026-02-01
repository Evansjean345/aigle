import { inject } from '@adonisjs/core'
import { UserStatus } from '#features/user/domain/enum'
import UserStateChanged from '#features/user/application/events/user_state_changed'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#features/user/domain/models/user'

@inject()
export default class ChangeUserStateUseCase {
  /**
   * Creates an instance of the class with a user repository dependency.
   *
   * @param {UserRepository} userRepository - The repository instance used for accessing and managing user data.
   */
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Executes the use case to change a user account state.
   *
   * @param {string} userId - The unique identifier of the user (usersUid).
   * @param {UserStatus} status - The new status to apply.
   * @return {Promise<void>}
   * @throws {Exception} If the user is not found.
   */
  async execute(userId: string, status: UserStatus): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('Utilisateur introuvable', {
        status: 404,
        code: 'USER_NOT_FOUND',
      })
    }

    if (user.status === status) {
      throw new Exception("Le statut de l'utilisateur est déjà le même", {
        status: 400,
        code: 'SAME_STATUS',
      })
    }

    if (user.status === UserStatus.INACTIVE || user.status === UserStatus.REJECTED) {
      throw new Exception("Impossible de modifier le statut d'un utilisateur inactif ou rejeté", {
        status: 400,
        code: 'INVALID_USER_STATE',
      })
    }

    user.status = status
    const updatedUser = await this.userRepository.save(user)

    if (updatedUser && updatedUser.status === UserStatus.BLOCKED) {
      const tokens = await User.accessTokens.all(user)
      await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))
    }

    await UserStateChanged.dispatch(userId, status)
  }
}
