import { type KycLevelLimitsResult } from '#core/identity/kyc/application/dtos/kyc_level.dto'

/**
 * Port de cache du catalogue de niveaux (`kyc_level`). L'application dépend de ce contrat ;
 * l'infrastructure (`KycLevelCacheService`) en fournit l'implémentation. La grille
 * `(segment, level) → limites` étant de la **donnée de référence quasi immuable** (éditée au
 * back-office) mais **lue à chaque validation money**, on met en cache la vue (`KycLevelLimitsResult`)
 * pour éviter de taper la base à chaque appel.
 */
export default abstract class KycLevelCache {
  /**
   * Retourne les limites du couple `(segment, level)` depuis le cache, ou via la `factory` (source
   * de vérité) qu'on met alors en cache. `null` = couple absent du catalogue.
   */
  abstract getLimits(
    segment: string,
    level: number,
    factory: () => Promise<KycLevelLimitsResult | null>
  ): Promise<KycLevelLimitsResult | null>

  /** Invalide l'entrée de cache d'un couple `(segment, level)` (édition back-office). */
  abstract invalidate(segment: string, level: number): Promise<void>
}
