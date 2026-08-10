import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import KycLevelNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_level_not_found_exception'
import KycLevelAlreadyExistsException from '#core/identity/kyc/domain/exceptions/kyc_level_already_exists_exception'
import {
  toKycLevelResult,
  type CreateKycLevelCommand,
  type UpdateKycLevelCommand,
  type KycLevelResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_level.dto'

/**
 * Gestion des niveaux KYC et de leurs plafonds.
 *
 * Un niveau porte les limites appliquées à tous les comptes qui l'atteignent : son unicité et sa
 * suppression sont contrôlées ici, non par l'appelant.
 */
@inject()
export default class KycLevelService {
  constructor(
    private readonly kycLevelRepository: KycLevelRepository,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * Liste tous les niveaux.
   *
   * @returns {Promise<KycLevelResult[]>} Les niveaux configurés.
   */
  async list(): Promise<KycLevelResult[]> {
    const levels = await this.kycLevelRepository.findAll()

    return levels.map(toKycLevelResult)
  }

  /**
   * Crée un niveau.
   *
   * @param {CreateKycLevelCommand} command - Niveau et plafonds.
   * @returns {Promise<KycLevelResult>} Le niveau créé.
   * @throws {KycLevelAlreadyExistsException} Un niveau porte déjà ce rang.
   */
  async create(command: CreateKycLevelCommand): Promise<KycLevelResult> {
    const existing = await this.kycLevelRepository.findByLevel(command.level)

    if (existing) {
      throw new KycLevelAlreadyExistsException(command.level)
    }

    const kycLevel = new KycLevel()
    kycLevel.level = command.level
    kycLevel.singleLimit = command.singleLimit
    kycLevel.dailyLimit = command.dailyLimit
    kycLevel.monthlyLimit = command.monthlyLimit
    kycLevel.balanceLimit = command.balanceLimit

    if (command.isActive !== undefined) kycLevel.isActive = command.isActive
    if (command.isArchived !== undefined) kycLevel.isArchived = command.isArchived

    await this.kycLevelRepository.save(kycLevel)

    return toKycLevelResult(kycLevel)
  }

  /**
   * Met à jour un niveau.
   *
   * Renvoie l'état d'avant et d'après : la piste d'audit doit dire ce qui a changé, et l'appelant
   * n'a plus accès au niveau une fois modifié.
   *
   * @param {number} id - Niveau visé.
   * @param {UpdateKycLevelCommand} command - Champs à modifier.
   * @returns {Promise<{ before: KycLevelResult; after: KycLevelResult }>} Les deux états.
   * @throws {KycLevelNotFoundException} Niveau inconnu.
   * @throws {KycLevelAlreadyExistsException} Le rang demandé est déjà pris.
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

    if (command.level !== undefined) {
      const existing = await this.kycLevelRepository.findByLevel(command.level)

      if (existing && Number(existing.id) !== Number(id)) {
        throw new KycLevelAlreadyExistsException(command.level)
      }

      kycLevel.level = command.level
    }

    if (command.singleLimit !== undefined) kycLevel.singleLimit = command.singleLimit
    if (command.dailyLimit !== undefined) kycLevel.dailyLimit = command.dailyLimit
    if (command.monthlyLimit !== undefined) kycLevel.monthlyLimit = command.monthlyLimit
    if (command.balanceLimit !== undefined) kycLevel.balanceLimit = command.balanceLimit
    if (command.isActive !== undefined) kycLevel.isActive = command.isActive
    if (command.isArchived !== undefined) kycLevel.isArchived = command.isArchived

    await this.kycLevelRepository.save(kycLevel)

    return { before, after: toKycLevelResult(kycLevel) }
  }

  /**
   * Supprime un niveau.
   *
   * Refusé tant que des comptes y sont rattachés : ils perdraient leurs plafonds.
   *
   * @param {number} id - Niveau visé.
   * @returns {Promise<KycLevelResult>} Le niveau supprimé, pour la piste d'audit.
   * @throws {KycLevelNotFoundException} Niveau inconnu.
   * @throws {Exception} Des comptes utilisent encore ce niveau.
   */
  async delete(id: number): Promise<KycLevelResult> {
    const kycLevel = await this.kycLevelRepository.findById(id)

    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    const total = await this.userRepository.countByKycLevel(kycLevel.level)

    if (total > 0) {
      throw new Exception(
        `Impossible de supprimer ce niveau KYC : ${total} compte(s) utilisateur(s) y sont liés.`,
        { status: 409, code: 'E_KYC_LEVEL_IN_USE' }
      )
    }

    const snapshot = toKycLevelResult(kycLevel)
    await this.kycLevelRepository.delete(kycLevel)

    return snapshot
  }
}
