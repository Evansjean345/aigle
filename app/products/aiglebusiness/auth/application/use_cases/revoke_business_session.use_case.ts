import { inject } from '@adonisjs/core'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'

/**
 * Révoque une session (déconnecte ce navigateur/appareil) de l'utilisateur business
 * (Lot 3). Délègue au service core ; l'ownership est vérifié côté core (404 sinon).
 */
@inject()
export default class RevokeBusinessSessionUseCase {
  constructor(private readonly userSessionService: UserSessionService) {}

  execute(
    userId: string,
    tokenId: string,
    currentTokenId?: string | number
  ): Promise<{ wasCurrent: boolean }> {
    return this.userSessionService.revoke(userId, tokenId, currentTokenId)
  }
}
