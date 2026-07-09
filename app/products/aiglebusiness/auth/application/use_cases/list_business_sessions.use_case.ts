import { inject } from '@adonisjs/core'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'
import { type UserSessionResult } from '#core/identity/authentication/application/dtos/user_session_result'

/**
 * Liste les sessions actives de l'utilisateur business (Lot 3). Délègue au service
 * core, sans toucher au modèle User (invariant produit→core).
 */
@inject()
export default class ListBusinessSessionsUseCase {
  constructor(private readonly userSessionService: UserSessionService) {}

  execute(userId: string, currentTokenId?: string | number): Promise<UserSessionResult[]> {
    return this.userSessionService.listActive(userId, currentTokenId)
  }
}
