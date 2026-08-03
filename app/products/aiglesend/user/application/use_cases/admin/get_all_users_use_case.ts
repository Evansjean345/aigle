import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'
import type { PaginatedUsersResult } from '#core/identity/user/application/dtos/user_admin.dto'

/**
 * Liste les utilisateurs pour l'espace admin.
 */
@inject()
export default class GetAllUsersUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la lecture.
   *
   * @param {number} [page] - Page demandée.
   * @param {number} [perPage] - Taille de page.
   * @param {string} [search] - Fragment de nom ou de téléphone.
   * @param {string} [startDate] - Borne basse de création.
   * @param {string} [endDate] - Borne haute de création.
   * @returns {Promise<PaginatedUsersResult>} La page demandée.
   */
  async execute(
    page: number = 1,
    perPage: number = 16,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PaginatedUsersResult> {
    return this.userAdminService.list(page, perPage, search, startDate, endDate)
  }
}
