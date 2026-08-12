import { inject } from '@adonisjs/core'
import type { KycLevelDefinition } from '#core/identity/kyc/domain/kyc_level_catalog'
import type {
  KycLevelCatalogDiffResult,
  UnknownKycLevelResult,
} from '#core/identity/kyc/application/dtos/kyc_level_catalog.dto'
import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'

/** Compare le catalogue des paliers déclaré en code à la grille en base. */
@inject()
export default class KycLevelCatalogDiffService {
  constructor(private kycLevelRepository: KycLevelRepository) {}

  /**
   * Constate l'écart entre un catalogue et la grille.
   *
   * Les montants ne sont jamais comparés : le catalogue ne les pose qu'à la création d'un palier.
   *
   * @param {readonly KycLevelDefinition[]} catalog - Les paliers déclarés en code.
   * @returns {Promise<KycLevelCatalogDiffResult>} Les paliers manquants en base et ceux qui y sont
   *   sans être déclarés.
   */
  async compare(catalog: readonly KycLevelDefinition[]): Promise<KycLevelCatalogDiffResult> {
    const persisted = await this.kycLevelRepository.findAll()
    const persistedKeys = new Set(persisted.map((level) => `${level.segment}:${level.level}`))

    const declaredKeys = new Set(
      catalog.map((definition) => `${definition.segment}:${definition.level}`)
    )

    const missing = catalog.filter(
      (definition) => !persistedKeys.has(`${definition.segment}:${definition.level}`)
    )

    const unknown: UnknownKycLevelResult[] = persisted
      .filter((level) => !declaredKeys.has(`${level.segment}:${level.level}`))
      .map((level) => ({ segment: level.segment, level: level.level }))

    return { missing, unknown }
  }
}
