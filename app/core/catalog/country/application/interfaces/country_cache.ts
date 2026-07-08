import { type CountryLookupResult } from '#core/catalog/country/application/dtos/country_lookup_result'

/**
 * Port de cache du référentiel pays. L'application dépend de ce contrat ;
 * l'infrastructure (`CountryCacheService`) en fournit l'implémentation. Le pays
 * étant du référentiel quasi immuable, on met en cache la vue (`CountryLookupResult`)
 * pour éviter de taper la base à chaque lecture.
 */
export default abstract class CountryCache {
  /**
   * Retourne le pays depuis le cache, ou via la `factory` (source de vérité) qu'on
   * met alors en cache. La factory peut lever (ex : pays absent) : l'erreur remonte
   * et n'est pas mise en cache.
   */
  abstract getById(
    id: number,
    factory: () => Promise<CountryLookupResult>
  ): Promise<CountryLookupResult>

  /** Invalide l'entrée de cache d'un pays. */
  abstract invalidate(id: number): Promise<void>
}
