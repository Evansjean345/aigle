import { inject } from '@adonisjs/core'
import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import CountryCache from '#core/catalog/country/application/interfaces/country_cache'
import type Country from '#core/catalog/country/domain/models/country'
import { type CountryLookupResult } from '#core/catalog/country/application/dtos/country_lookup_result'

/**
 * Port de consultation du référentiel pays exposé par le core aux couches externes.
 *
 * Les produits n'accèdent JAMAIS au `CountryRepository` ni au modèle `Country` : ils
 * passent par ce service, qui ne renvoie qu'une vue minimale (`CountryLookupResult`).
 * Frontière anti-corruption référentiel → produit. Les lectures passent par un cache
 * (référentiel quasi immuable) pour éviter de taper la base à chaque appel.
 */
@inject()
export default class CountryDirectoryService {
  constructor(
    private readonly countryRepository: CountryRepository,
    private readonly countryCache: CountryCache
  ) {}

  /**
   * Résout un pays par son identifiant (depuis le cache, sinon la base). Lève
   * `COUNTRY_NOT_FOUND` (400) si absent — l'erreur remonte et n'est pas mise en cache.
   */
  async findById(countryId: number): Promise<CountryLookupResult> {
    return this.countryCache.getById(countryId, async () => {
      const country = await this.countryRepository.findCountryBy('id', countryId)
      return this.toResult(country)
    })
  }

  private toResult(country: Country): CountryLookupResult {
    return {
      id: country.id,
      name: country.name,
      phoneCode: country.phoneCode,
    }
  }
}
