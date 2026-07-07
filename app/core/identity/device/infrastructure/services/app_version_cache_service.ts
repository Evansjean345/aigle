import { inject } from '@adonisjs/core'
import cache from '@adonisjs/cache/services/main'
import { DeviceType } from '#core/identity/device/domain/enums'
import AppVersion from '#core/identity/device/domain/models/app_version'

@inject()
export default class AppVersionCacheService {
  /**
   * A string constant used as a prefix for cache keys.
   * This prefix can be applied to all cache keys within the application
   * to ensure a consistent naming convention and avoid potential key conflicts.
   *
   * @constant {string} CACHE_KEY_PREFIX
   */
  private readonly CACHE_KEY_PREFIX = 'app_version'

  /**
   * Generates a cache key by combining a predefined cache key prefix with the given platform value.
   *
   * @param {DeviceType} platform - The platform for which the cache key is being generated.
   * @return {string} The generated cache key as a string.
   */
  private getCacheKey(platform: DeviceType): string {
    return `${this.CACHE_KEY_PREFIX}:${platform}`
  }

  /**
   * Retrieves the latest app version from the cache or fetches it using the provided factory function.
   *
   * @param {DeviceType} platform - The platform type for which the app version is being retrieved.
   * @param {function(): Promise<AppVersion|null>} factory - A function that fetches the latest app version.
   * @return {Promise<any>} A promise that resolves to the latest app version, serialized as JSON, or null if unavailable.
   */
  async getLatest(platform: DeviceType, factory: () => Promise<AppVersion | null>): Promise<any> {
    return await cache.getOrSet({
      key: this.getCacheKey(platform),
      factory: async () => {
        const query = await factory()
        return query ? query.toJSON() : null
      },
      ttl: '30m',
    })
  }

  /**
   * Invalidates the cache for the specified platform by deleting its associated cache key.
   *
   * @param {DeviceType} platform - The platform for which the cache should be invalidated.
   * @return {Promise<void>} A promise that resolves once the cache has been invalidated.
   */
  async invalidate(platform: DeviceType): Promise<void> {
    await cache.delete({
      key: this.getCacheKey(platform),
    })
  }
}
