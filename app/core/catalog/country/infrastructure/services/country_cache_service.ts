import cache from '@adonisjs/cache/services/main'
import type CountryCache from '#core/catalog/country/application/interfaces/country_cache'
import { type CountryLookupResult } from '#core/catalog/country/application/dtos/country_lookup_result'

/**
 * Implémentation du cache pays via `@adonisjs/cache` (load-through). Le référentiel
 * pays étant quasi immuable, un TTL long suffit ; `invalidate` permet un rafraîchissement
 * ponctuel si une donnée pays change.
 */
export default class CountryCacheService implements CountryCache {
  private readonly CACHE_KEY_PREFIX = 'country:id'

  private getCacheKey(id: number): string {
    return `${this.CACHE_KEY_PREFIX}:${id}`
  }

  async getById(
    id: number,
    factory: () => Promise<CountryLookupResult>
  ): Promise<CountryLookupResult> {
    return (await cache.getOrSet({
      key: this.getCacheKey(id),
      factory,
      ttl: '24h',
    })) as CountryLookupResult
  }

  async invalidate(id: number): Promise<void> {
    await cache.delete({ key: this.getCacheKey(id) })
  }
}
