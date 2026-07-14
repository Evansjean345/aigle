import type KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Implementation of the KycLevelRepository interface providing methods to interact with
 * the KYC levels data source.
 *
 * This class includes methods for retrieving, saving, and deleting KYC levels from
 * the database.
 */
export default class KycLevelRepositoryImpl implements KycLevelRepository {
  /**
   * Retrieves all KYC levels from the database, ordered by the 'level' field in ascending order.
   *
   * @return {Promise<KycLevel[]>} A promise that resolves to an array of KYC levels.
   */
  async findAll(): Promise<KycLevel[]> {
    return KycLevel.query().orderBy('level', 'asc')
  }

  /**
   * Retrieves a KycLevel instance by its unique identifier.
   *
   * @param {number} id - The unique identifier of the KycLevel to retrieve.
   * @return {Promise<KycLevel | null>} A promise that resolves to the KycLevel instance if found, or null if no such instance exists.
   */
  async findById(id: number): Promise<KycLevel | null> {
    return KycLevel.find(id)
  }

  /**
   * Finds a KycLevel by the given level.
   *
   * @param {number} level - The level to search for.
   * @return {Promise<KycLevel | null>} A promise that resolves to the found KycLevel or null if not found.
   */
  async findByLevel(level: number): Promise<KycLevel | null> {
    return KycLevel.findBy('level', level)
  }

  /**
   * Trouve la grille de limites d'un couple `(segment, level)`.
   *
   * @param {string} segment - Segment du compte (`particulier` | `marchand` | `enterprise`).
   * @param {number} level - Niveau du compte.
   * @return {Promise<KycLevel | null>} La ligne de limites, ou null si le couple n'existe pas.
   */
  async findBySegmentAndLevel(segment: string, level: number): Promise<KycLevel | null> {
    return KycLevel.query().where('segment', segment).where('level', level).first()
  }

  /**
   * Persists the given KYC level to the database.
   *
   * @param {KycLevel} kycLevel - The KYC level object to be saved.
   * @return {Promise<KycLevel>} A promise that resolves to the saved KYC level object.
   */
  async save(kycLevel: KycLevel): Promise<KycLevel> {
    return kycLevel.save()
  }

  /**
   * Deletes the specified KycLevel entry.
   *
   * @param {KycLevel} kycLevel - The KycLevel instance to be deleted.
   * @return {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async delete(kycLevel: KycLevel): Promise<void> {
    const query = await kycLevel.related('users').query().count('* as total')
    const usersCount = query[0].$extras.total

    if (usersCount > 0) {
      throw new Exception(
        'Vous ne pouvez pas supprimer ce niveau KYC car des utilisateurs y sont associés.',
        {
          status: 400,
          code: 'E_CANNOT_DELETE_KYC_LEVEL',
        }
      )
    }

    await kycLevel.delete()
  }
}
