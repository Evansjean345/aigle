import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import ListBusinessSessionsUseCase from '#aiglebusiness/auth/application/use_cases/list_business_sessions.use_case'
import RevokeBusinessSessionUseCase from '#aiglebusiness/auth/application/use_cases/revoke_business_session.use_case'

/**
 * Sessions actives de l'utilisateur business (Lot 3) : lister / révoquer. Groupe
 * authentifié (`auth` + `requireApp('aiglebusiness')`). Une session = un access
 * token ; la session courante est marquée.
 */
@inject()
export default class BusinessSessionController {
  constructor(
    private readonly listSessions: ListBusinessSessionsUseCase,
    private readonly revokeSession: RevokeBusinessSessionUseCase
  ) {}

  /** Liste les sessions actives, la courante marquée `current: true`. */
  async index({ auth, response }: HttpContext): Promise<void> {
    const currentTokenId = String(auth.user!.currentAccessToken.identifier)
    const userId = (auth.user as User).usersUid

    const result = await this.listSessions.execute(userId, currentTokenId)
    return response.ok(result)
  }

  /** Révoque une session (déconnecte ce navigateur/appareil). */
  async destroy({ auth, params, response }: HttpContext): Promise<void> {
    const currentTokenId = String(auth.user!.currentAccessToken.identifier)
    const userId = (auth.user as User).usersUid

    await this.revokeSession.execute(userId, String(params.id), currentTokenId)
    return response.noContent()
  }
}
