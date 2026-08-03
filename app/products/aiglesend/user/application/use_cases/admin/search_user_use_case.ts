import { inject } from '@adonisjs/core'
import UserAdminService from '#core/identity/user/application/services/user_admin_service'
import type { UserSearchResult } from '#core/identity/user/application/dtos/user_admin.dto'

/**
 * Autocomplétion sur l'annuaire des utilisateurs.
 */
@inject()
export default class SearchUserUseCase {
  constructor(private readonly userAdminService: UserAdminService) {}

  /**
   * Exécute la recherche.
   *
   * @param {string} search - Fragment recherché.
   * @returns {Promise<UserSearchResult[]>} Les correspondances.
   */
  async execute(search: string): Promise<UserSearchResult[]> {
    return this.userAdminService.search(search)
  }
}
