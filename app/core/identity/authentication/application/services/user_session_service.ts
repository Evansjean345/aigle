import { inject } from '@adonisjs/core'
import { type AccessToken } from '@adonisjs/auth/access_tokens'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { type UserSessionResult } from '#core/identity/authentication/application/dtos/user_session_result'
import { CHANNEL_ABILITY_PREFIX } from '#core/identity/authentication/domain/enums/client_channel'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import SessionNotFoundException from '#core/identity/authentication/domain/exceptions/session_not_found_exception'

/**
 * Sessions d'un utilisateur. Une session est un access token.
 *
 * Seul point d'accès aux jetons pour les produits : ils passent par ce service, par `userId', sans
 * toucher au modèle `User'.
 */
@inject()
export default class UserSessionService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Liste les sessions actives d'un utilisateur pour une app.
   *
   * Les sessions des autres apps ne sont pas rendues : le jeton porte l'ability `app:<name>`, et
   * un même compte ouvre des sessions dans plusieurs apps.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {AppName} app - App dont on liste les sessions.
   * @param {string | number} [currentTokenId] - Jeton de la requête courante, marqué `current`.
   * @returns {Promise<UserSessionResult[]>} Les sessions ouvertes de cette app.
   * @throws {PhoneNotFoundException} Utilisateur introuvable.
   */
  async listActive(
    userId: string,
    app: AppName,
    currentTokenId?: string | number
  ): Promise<UserSessionResult[]> {
    const user = await this.requireUser(userId)
    const tokens = await this.appTokens(user, app)

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
   * Révoque une session d'un utilisateur pour une app.
   *
   * Une session d'une autre app est introuvable, non refusée : une app n'a pas à savoir ce que
   * le compte ouvre ailleurs.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string | number} tokenId - Session à révoquer.
   * @param {AppName} app - App dont relève la session.
   * @param {string | number} [currentTokenId] - Jeton de la requête courante.
   * @returns {Promise<{ wasCurrent: boolean }>} `wasCurrent` indique que l'appelant vient de se
   *   déconnecter lui-même.
   * @throws {PhoneNotFoundException} Utilisateur introuvable.
   * @throws {SessionNotFoundException} La session n'appartient pas à cet utilisateur, ou relève
   *   d'une autre app.
   */
  async revoke(
    userId: string,
    tokenId: string | number,
    app: AppName,
    currentTokenId?: string | number
  ): Promise<{ wasCurrent: boolean }> {
    const user = await this.requireUser(userId)
    const tokens = await this.appTokens(user, app)

    const owned = tokens.find((token) => String(token.identifier) === String(tokenId))

    if (!owned) {
      throw new SessionNotFoundException()
    }

    await User.accessTokens.delete(user, owned.identifier)

    return {
      wasCurrent: currentTokenId !== undefined && String(tokenId) === String(currentTokenId),
    }
  }

  /**
   * Révoque les sessions portant un nom donné.
   *
   * Le nom est la seule attache entre un jeton et ce qui l'a émis — `device:<id>` pour une
   * connexion mobile. Un nom sans session ouverte n'est pas une erreur : l'appelant retire un
   * appareil, la session avait pu expirer avant.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string} name - Nom des sessions à révoquer.
   * @param {AppName} app - App dont relèvent les sessions.
   * @returns {Promise<number>} Le nombre de sessions révoquées.
   * @throws {PhoneNotFoundException} Utilisateur introuvable.
   */
  async revokeByName(userId: string, name: string, app: AppName): Promise<number> {
    const user = await this.requireUser(userId)
    const tokens = await this.appTokens(user, app)
    const named = tokens.filter((token) => token.name === name)

    await Promise.all(named.map((token) => User.accessTokens.delete(user, token.identifier)))

    return named.length
  }

  /**
   * Révoque les sessions d'une seule app pour un lot d'utilisateurs.
   *
   * Les sessions des autres apps sont conservées : le jeton porte l'ability `app:<name>`. Un
   * utilisateur introuvable est ignoré.
   *
   * @param {string[]} userIds - Utilisateurs visés. Les doublons sont sans effet.
   * @param {AppName} app - Application dont les sessions tombent.
   * @returns {Promise<number>} Nombre de sessions révoquées.
   */
  async revokeAppSessions(userIds: string[], app: AppName): Promise<number> {
    let revoked = 0

    for (const userId of new Set(userIds)) {
      const user = await this.userRepository.findById(userId)
      if (!user) continue

      const scoped = await this.appTokens(user, app)

      await Promise.all(scoped.map((token) => User.accessTokens.delete(user, token.identifier)))
      revoked += scoped.length
    }

    return revoked
  }

  /**
   * Jetons d'un utilisateur pour une app.
   *
   * L'app est portée par l'ability `app:<name>` du jeton : c'est la seule chose qui rattache une
   * session à l'application qui l'a ouverte.
   *
   * @param {User} user - Utilisateur dont on lit les jetons.
   * @param {AppName} app - App dont relèvent les jetons.
   * @returns {Promise<AccessToken[]>} Les jetons de cette app.
   */
  private async appTokens(user: User, app: AppName): Promise<AccessToken[]> {
    const ability = appAbility(app)
    const tokens = await User.accessTokens.all(user)

    return tokens.filter((token) => token.abilities.includes(ability))
  }

  /**
   * Charge un utilisateur par son identifiant public.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<User>} L'utilisateur.
   * @throws {PhoneNotFoundException} Identifiant inconnu.
   */
  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    return user
  }

  /**
   * Extrait le canal (`mobile`/`web`) depuis l'ability `channel:` du jeton.
   *
   * @param {string[]} abilities - Abilities portées par le jeton.
   * @returns {string | null} Le canal, ou `null` si le jeton n'en porte pas.
   */
  private extractChannel(abilities: string[]): string | null {
    const found = abilities.find((ability) => ability.startsWith(CHANNEL_ABILITY_PREFIX))
    return found ? found.slice(CHANNEL_ABILITY_PREFIX.length) : null
  }
}
