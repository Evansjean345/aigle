import { inject } from '@adonisjs/core'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { type UserSessionResult } from '#core/identity/authentication/application/dtos/user_session_result'

/**
 * Liste les sessions actives de l'utilisateur sur l'app business.
 *
 * Ne rend que les sessions de cette app : ce que le compte ouvre dans AigleSend ne regarde pas
 * le business. Une session web n'a pas d'appareil ; les appareils relèvent de
 * `GET business/devices`.
 */
@inject()
export default class ListBusinessSessionsUseCase {
  constructor(private readonly userSessionService: UserSessionService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string | number} [currentTokenId] - Jeton de la requête courante, marqué `current`.
   * @returns {Promise<UserSessionResult[]>} Les sessions business ouvertes.
   */
  execute(userId: string, currentTokenId?: string | number): Promise<UserSessionResult[]> {
    return this.userSessionService.listActive(userId, AppName.AIGLEBUSINESS, currentTokenId)
  }
}
