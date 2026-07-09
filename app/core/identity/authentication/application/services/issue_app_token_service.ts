import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'

/**
 * Émet un access token **stampé de l'app** d'origine (`app:<name>` en ability),
 * socle du cloisonnement par produit. Point d'émission unique, réutilisable par
 * aiglesend (core) et par les produits (qui passent par `issue(userId, ...)` sans
 * toucher au modèle `User`).
 */
@inject()
export default class IssueAppTokenService {
  constructor(private readonly userRepository: UserRepository) {}

  /** Émet pour un `User` déjà chargé (appelants core). Renvoie le token en clair. */
  async issueForUser(user: User, app: AppName, options?: { name?: string }): Promise<string> {
    const token = await User.accessTokens.create(user, [appAbility(app)], options)
    return token.value!.release()
  }

  /** Émet pour un `userId` (appelants produit) : charge le user puis délègue. */
  async issue(userId: string, app: AppName, options?: { name?: string }): Promise<string> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new PhoneNotFoundException()
    }
    return this.issueForUser(user, app, options)
  }
}
