import { inject } from '@adonisjs/core'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Révoque une session business — déconnecte ce navigateur ou cet appareil.
 *
 * Ne porte que sur les sessions de cette app : une session AigleSend est introuvable depuis ici.
 *
 * Déconnecter n'est pas retirer : l'appareil reste de confiance et se reconnectera sans consommer
 * de nouvelle place. Le retrait est `DELETE business/devices/:id`.
 */
@inject()
export default class RevokeBusinessSessionUseCase {
  constructor(private readonly userSessionService: UserSessionService) {}

  /**
   * Exécute la révocation.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string} tokenId - Session à révoquer.
   * @param {string | number} [currentTokenId] - Jeton de la requête courante.
   * @returns {Promise<{ wasCurrent: boolean }>} `wasCurrent` indique que l'appelant vient de se
   *   déconnecter lui-même.
   * @throws {SessionNotFoundException} Session inconnue, d'un autre compte, ou d'une autre app.
   */
  execute(
    userId: string,
    tokenId: string,
    currentTokenId?: string | number
  ): Promise<{ wasCurrent: boolean }> {
    return this.userSessionService.revoke(userId, tokenId, AppName.AIGLEBUSINESS, currentTokenId)
  }
}
