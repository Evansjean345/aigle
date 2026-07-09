import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import {
  ClientChannel,
  channelAbility,
} from '#core/identity/authentication/domain/enums/client_channel'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'

interface IssueOptions {
  name?: string
  /** Canal du client (mobile/web) → stampé `channel:<name>` sur le token. */
  channel?: ClientChannel
}

/**
 * Émet un access token **stampé de l'app** d'origine (`app:<name>`) et, optionnellement,
 * du **canal** (`channel:<name>`). Socle du cloisonnement par produit. Point d'émission
 * unique, réutilisable par aiglesend (core) et par les produits (via `issue(userId, ...)`
 * sans toucher au modèle `User`).
 */
@inject()
export default class IssueAppTokenService {
  constructor(private readonly userRepository: UserRepository) {}

  /** Émet pour un `User` déjà chargé (appelants core). Renvoie le token en clair. */
  async issueForUser(user: User, app: AppName, options?: IssueOptions): Promise<string> {
    const abilities = [appAbility(app)]
    if (options?.channel) {
      abilities.push(channelAbility(options.channel))
    }
    const token = await User.accessTokens.create(user, abilities, { name: options?.name })
    return token.value!.release()
  }

  /** Émet pour un `userId` (appelants produit) : charge le user puis délègue. */
  async issue(userId: string, app: AppName, options?: IssueOptions): Promise<string> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    return this.issueForUser(user, app, options)
  }
}
