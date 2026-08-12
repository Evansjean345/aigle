import { inject } from '@adonisjs/core'
import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import KycLevelCache from '#core/identity/kyc/application/interfaces/kyc_level_cache'
import KycLevelNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_level_not_found_exception'
import {
  toKycLevelResult,
  type UpdateKycLevelCommand,
  type KycLevelResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_level.dto'

/**
 * Consultation et ajustement des paliers de vérification.
 *
 * Un palier n'est pas une donnée de configuration : c'est une **signification** — ce qu'un compte a
 * le droit d'engager — qui doit exister en code avant d'exister en base. Le couple
 * `(segment, level)` est donc figé, et seuls ses montants s'ajustent.
 *
 * Ce service ne crée ni ne supprime aucun palier. En créer un donnerait un rang qu'aucune règle ne
 * prévoit ; en supprimer un laisserait les comptes qui le portent sans limites résolues.
 */
@inject()
export default class KycLevelService {
  constructor(
    private readonly kycLevelRepository: KycLevelRepository,
    private readonly kycLevelCache: KycLevelCache
  ) {}

  /**
   * Liste tous les paliers.
   *
   * @returns {Promise<KycLevelResult[]>} Les paliers configurés.
   */
  async list(): Promise<KycLevelResult[]> {
    const levels = await this.kycLevelRepository.findAll()

    return levels.map(toKycLevelResult)
  }

  /**
   * Ajuste les montants d'un palier.
   *
   * Ni le segment ni le rang ne bougent : déplacer un palier reviendrait à lui donner une
   * signification qu'il n'a pas en code, et les comptes qui le portent changeraient de plafonds
   * sans qu'aucune décision les concernant n'ait été prise.
   *
   * @param {number} id - Palier visé.
   * @param {UpdateKycLevelCommand} command - Montants à modifier.
   * @returns {Promise<{ before: KycLevelResult; after: KycLevelResult }>} Les deux états, pour la
   *   piste d'audit.
   * @throws {KycLevelNotFoundException} Palier inconnu.
   */
  async update(
    id: number,
    command: UpdateKycLevelCommand
  ): Promise<{ before: KycLevelResult; after: KycLevelResult }> {
    const kycLevel = await this.kycLevelRepository.findById(id)

    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    const before = toKycLevelResult(kycLevel)

    if (command.singleLimit !== undefined) kycLevel.singleLimit = command.singleLimit
    if (command.dailyLimit !== undefined) kycLevel.dailyLimit = command.dailyLimit
    if (command.monthlyLimit !== undefined) kycLevel.monthlyLimit = command.monthlyLimit
    if (command.balanceLimit !== undefined) kycLevel.balanceLimit = command.balanceLimit

    await this.kycLevelRepository.save(kycLevel)

    // Le cache tient 24 h : sans cette invalidation, les comptes garderaient les anciens plafonds
    // toute une journée. Une seule clé à purger, le couple ne pouvant plus changer.
    await this.kycLevelCache.invalidate(kycLevel.segment, kycLevel.level)

    return { before, after: toKycLevelResult(kycLevel) }
  }
}
