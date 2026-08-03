import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'
import type { UserWalletStatsResult } from '#core/identity/user/application/dtos/user_admin.dto'

/**
 * Portefeuille d'un utilisateur et son activité, pour l'espace admin.
 */
@inject()
export default class GetUserWalletStatsUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<UserWalletStatsResult>} Solde, plafonds et activité du jour.
   * @throws {Exception} Compte inconnu, ou portefeuille et limites KYC absents.
   */
  async execute(userId: string): Promise<UserWalletStatsResult> {
    return this.userAdminService.getWalletStats(userId)
  }
}
