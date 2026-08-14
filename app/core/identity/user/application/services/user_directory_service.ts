import { inject } from '@adonisjs/core'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import type User from '#core/identity/user/domain/models/user'
import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import {
  AccountVerificationStatus,
  statusOfFile,
} from '#core/identity/kyc/domain/verification_status'
import { normalizePhone } from '#shared/utils/utiles'
import { searchAccountIdsTripwire } from '#config/app'
import appLog from '#shared/infrastructure/logging/app_log'

/**
 * Consultation d'identité offerte par le core aux couches externes.
 *
 * Ne rend jamais le modèle `User`, seulement une vue minimale : les produits passent par ce service
 * et n'atteignent ni `UserRepository` ni le modèle.
 */
@inject()
export default class UserDirectoryService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Recherche un utilisateur par téléphone, le numéro étant normalisé avant la requête.
   *
   * @param {string} phone - Numéro sous n'importe quelle forme : `07…`, `+225…`, `00225…`, `225…`.
   * @returns {Promise<UserLookupResult | null>} L'utilisateur, ou `null` si le numéro est inconnu.
   */
  async findByPhone(phone: string): Promise<UserLookupResult | null> {
    const user = await this.userRepository.findByPhone(normalizePhone(phone))

    if (!user) return null

    await user.load('kycDocument')

    return this.toResult(user)
  }

  /**
   * Recherche un utilisateur par son identifiant.
   *
   * @param {string} userId - Identifiant de l'utilisateur (`users_uid`).
   * @returns {Promise<UserLookupResult | null>} L'utilisateur, ou `null` s'il n'existe pas.
   */
  async findById(userId: string): Promise<UserLookupResult | null> {
    const user = await this.userRepository.findById(userId)

    if (!user) return null

    await user.load('kycDocument')

    return this.toResult(user)
  }

  /**
   * Résout plusieurs utilisateurs en une requête, indexés par leur identifiant.
   *
   * @param {string[]} userIds - Identifiants à résoudre.
   * @returns {Promise<Map<string, UserLookupResult>>} Les utilisateurs trouvés. Un identifiant
   *   inconnu est absent de la table.
   */
  async mapByIds(userIds: string[]): Promise<Map<string, UserLookupResult>> {
    const users = await this.userRepository.findByIds(userIds)
    return new Map(users.map((user) => [user.usersUid, this.toResult(user)]))
  }

  /**
   * Identifiants des utilisateurs dont le prénom, le nom, l'identifiant ou — au choix — le téléphone
   * contient le terme, sans égard à la casse.
   *
   * Ne tronque pas : au-delà du fil de détente, journalise et rend l'ensemble.
   *
   * @param {string} term - Terme recherché.
   * @param {object} [options] - `phone` à `false` restreint la recherche au nom et à l'identifiant,
   *   pour un écran qui n'affiche pas le numéro.
   * @returns {Promise<string[]>} Les identifiants correspondants, vide si aucun.
   */
  async searchAccountIds(term: string, options: { phone?: boolean } = {}): Promise<string[]> {
    const userIds = await this.userRepository.searchIds(term, searchAccountIdsTripwire, {
      phone: options.phone ?? true,
    })

    if (userIds.length >= searchAccountIdsTripwire) {
      appLog.error(
        'LIST_SEARCH_TRIPWIRE_REACHED',
        { directory: 'user', term, count: userIds.length },
        "La recherche d'utilisateurs atteint le fil de détente"
      )
    }

    return userIds
  }

  /** Projette un utilisateur en vue minimale. La photo n'accompagne qu'un compte vérifié. */
  private toResult(user: User): UserLookupResult {
    const kycVerified = statusOfFile(user.kycDocument) === AccountVerificationStatus.VERIFIED
    return {
      userId: user.usersUid,
      firstname: user.firstname ?? null,
      lastname: user.lastname ?? null,
      phone: user.phone,
      kycVerified,
      pictureUrl: kycVerified ? user.pictureUrl || null : null,
    }
  }
}
