import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'
import type { UserDetailsResult } from '#core/identity/user/application/dtos/user_admin.dto'

/**
 * Fiche complète d'un utilisateur pour l'espace admin.
 */
@inject()
export default class GetAdminUserDetailsUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<UserDetailsResult | null>} La fiche, ou `null` si le compte n'existe pas.
   */
  async execute(userId: string): Promise<UserDetailsResult | null> {
    return this.userAdminService.findDetails(userId)
  }
}
