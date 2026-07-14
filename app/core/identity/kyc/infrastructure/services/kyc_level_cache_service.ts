import cache from '@adonisjs/cache/services/main'
import type KycLevelCache from '#core/identity/kyc/application/interfaces/kyc_level_cache'
import { type KycLevelLimitsResult } from '#core/identity/kyc/application/dtos/kyc_level.dto'

/**
 * Implémentation du cache des niveaux via `@adonisjs/cache` (load-through). Le catalogue
 * `(segment, level) → limites` étant quasi immuable, un TTL long suffit ; `invalidate` permet un
 * rafraîchissement ponctuel quand une limite change au back-office.
 */
export default class KycLevelCacheService implements KycLevelCache {
  private readonly CACHE_KEY_PREFIX = 'kyc_level:limits'

  private getCacheKey(segment: string, level: number): string {
    return `${this.CACHE_KEY_PREFIX}:${segment}:${level}`
  }

  async getLimits(
    segment: string,
    level: number,
    factory: () => Promise<KycLevelLimitsResult | null>
  ): Promise<KycLevelLimitsResult | null> {
    return (await cache.getOrSet({
      key: this.getCacheKey(segment, level),
      factory,
      ttl: '24h',
    })) as KycLevelLimitsResult | null
  }

  async invalidate(segment: string, level: number): Promise<void> {
    await cache.delete({ key: this.getCacheKey(segment, level) })
  }
}
