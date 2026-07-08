import { inject } from '@adonisjs/core'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import type User from '#core/identity/user/domain/models/user'
import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import { normalizePhone } from '#shared/utils/utiles'

/**
 * Port de consultation d'identité exposé par le core aux couches externes.
 *
 * Les produits (ex : aiglebusiness) n'accèdent JAMAIS au `UserRepository` ni au
 * modèle `User` : ils passent par ce service, qui ne renvoie qu'une vue minimale
 * ('UserLookupResult'). C'est la frontière anti-corruption identité → produit.
 */
@inject()
export default class UserDirectoryService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Recherche un utilisateur par téléphone. Le numéro entrant (saisi côté appelant :
   * local `07…`, `+225…`, `00225…` ou déjà `225…`) est **normalisé** ici avant la
   * recherche — l'appelant n'a pas à connaître le format canonique.
   */
  async findByPhone(phone: string): Promise<UserLookupResult | null> {
    const user = await this.userRepository.findByPhone(normalizePhone(phone))
    return user ? this.toResult(user) : null
  }

  /** Recherche un utilisateur par son identifiant (users_uid). */
  async findById(userId: string): Promise<UserLookupResult | null> {
    const user = await this.userRepository.findById(userId)
    return user ? this.toResult(user) : null
  }

  /**
   * Résout plusieurs utilisateurs en UNE requête, indexés par leur id — pour éviter
   * le N+1 lors de l'enrichissement d'une liste (ex : membres d'une organisation).
   */
  async mapByIds(userIds: string[]): Promise<Map<string, UserLookupResult>> {
    const users = await this.userRepository.findByIds(userIds)
    return new Map(users.map((user) => [user.usersUid, this.toResult(user)]))
  }

  private toResult(user: User): UserLookupResult {
    return {
      userId: user.usersUid,
      firstname: user.firstname ?? null,
      lastname: user.lastname ?? null,
      phone: user.phone,
      kycVerified: user.kycStatus === UserKycStatus.VERIFIED,
    }
  }
}
