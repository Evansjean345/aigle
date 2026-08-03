import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'
import { UserStatus } from '#core/identity/user/domain/enum'

/**
 * Change l'état d'un compte utilisateur depuis le back-office.
 */
@inject()
export default class ChangeUserStateUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la bascule.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {UserStatus} status - Nouvel état.
   * @throws {Exception} Compte inconnu, état identique, ou compte inactif ou rejeté.
   */
  async execute(userId: string, status: UserStatus): Promise<void> {
    return this.userAdminService.changeState(userId, status)
  }
}
