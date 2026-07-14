import { inject } from '@adonisjs/core'
import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import KycLevelCache from '#core/identity/kyc/application/interfaces/kyc_level_cache'
import { type KycLevelLimitsResult } from '#core/identity/kyc/application/dtos/kyc_level.dto'

/**
 * Port de consultation du catalogue de niveaux exposé par la feature `kyc` aux **autres features**.
 *
 * Les consommateurs (ex. `identity/account` pour le standing d'un compte) passent par ce service —
 * **jamais** par `KycLevelRepository` ni le modèle `KycLevel` (frontière anti-corruption entre
 * features, généralisation de « produit consomme core par service »). Renvoie un `Result` minimal.
 *
 * Lectures **mises en cache** (catalogue quasi immuable, lu à chaque validation money) : le service
 * passe par `KycLevelCache` (load-through), la base n'est touchée qu'au premier accès / après
 * expiration ou invalidation.
 */
@inject()
export default class KycLevelDirectoryService {
  constructor(
    private readonly kycLevelRepository: KycLevelRepository,
    private readonly kycLevelCache: KycLevelCache
  ) {}

  /**
   * Résout les **limites** d'un couple `(segment, level)`, depuis le cache sinon la base. Plafonds
   * `null` = illimité.
   *
   * @param segment Segment du compte (`particulier` | `marchand` | `enterprise`).
   * @param level Niveau du compte.
   * @return Les limites projetées, ou `null` si le couple n'existe pas dans le catalogue.
   */
  async getLimits(segment: string, level: number): Promise<KycLevelLimitsResult | null> {
    return this.kycLevelCache.getLimits(segment, level, async () => {
      const grid = await this.kycLevelRepository.findBySegmentAndLevel(segment, level)
      if (!grid) return null

      return {
        single: grid.singleLimit,
        daily: grid.dailyLimit,
        monthly: grid.monthlyLimit,
        balance: grid.balanceLimit,
      }
    })
  }
}
