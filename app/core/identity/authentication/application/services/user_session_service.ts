import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { type UserSessionResult } from '#core/identity/authentication/application/dtos/user_session_result'
import { CHANNEL_ABILITY_PREFIX } from '#core/identity/authentication/domain/enums/client_channel'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import SessionNotFoundException from '#core/identity/authentication/domain/exceptions/session_not_found_exception'

/**
 * Gestion des sessions d'un utilisateur (Lot 3). Une session = un access token
 * (décision #8). Service CORE : il touche le modèle `User`/`accessTokens` ; les
 * produits passent par lui (par userId), sans toucher au modèle (invariant
 * produit→core).
 */
@inject()
export default class UserSessionService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Liste les sessions actives d'un utilisateur. `currentTokenId` (identifiant du
   * token de la requête courante) marque la session en cours.
   */
  async listActive(userId: string, currentTokenId?: string | number): Promise<UserSessionResult[]> {
    const user = await this.requireUser(userId)
    const tokens = await User.accessTokens.all(user)

    return tokens.map((token) => ({
      id: String(token.identifier),
      name: token.name,
      channel: this.extractChannel(token.abilities),
      lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
      createdAt: token.createdAt ? token.createdAt.toISOString() : null,
      current: currentTokenId !== undefined && String(token.identifier) === String(currentTokenId),
    }))
  }

  /**
   * Révoque une session (déconnecte ce token). Vérifie qu'elle appartient bien à
   * l'utilisateur (sinon SessionNotFound). Renvoie `true` si c'était la session
   * courante (le contrôleur peut en tirer des conséquences).
   */
  async revoke(
    userId: string,
    tokenId: string | number,
    currentTokenId?: string | number
  ): Promise<{ wasCurrent: boolean }> {
    const user = await this.requireUser(userId)
    const tokens = await User.accessTokens.all(user)

    const owned = tokens.find((token) => String(token.identifier) === String(tokenId))
    if (!owned) {
      throw new SessionNotFoundException()
    }

    await User.accessTokens.delete(user, owned.identifier)

    return {
      wasCurrent: currentTokenId !== undefined && String(tokenId) === String(currentTokenId),
    }
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new PhoneNotFoundException()
    }
    return user
  }

  /** Extrait le canal (`mobile`/`web`) depuis l'ability `channel:` du token, si présente. */
  private extractChannel(abilities: string[]): string | null {
    const found = abilities.find((ability) => ability.startsWith(CHANNEL_ABILITY_PREFIX))
    return found ? found.slice(CHANNEL_ABILITY_PREFIX.length) : null
  }
}
