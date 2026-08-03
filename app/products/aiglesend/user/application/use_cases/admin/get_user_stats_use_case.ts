import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'

/**
 * Compteurs de l'annuaire des utilisateurs.
 */
@inject()
export default class GetUserStatsUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} [startDate] - Borne basse de création.
   * @param {string} [endDate] - Borne haute de création.
   * @returns {Promise<Record<string, number>>} Les compteurs globaux.
   */
  async execute(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    return this.userAdminService.getStats(startDate, endDate)
  }
}
