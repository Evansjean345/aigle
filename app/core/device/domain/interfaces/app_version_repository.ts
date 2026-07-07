import type AppVersion from '../models/app_version.js'

export default abstract class AppVersionRepository {
  /**
   * Retrieves the latest app version configuration for a specific device type.
   * @param deviceType
   */
  abstract findLatestByDeviceType(deviceType: 'ios' | 'android'): Promise<AppVersion | null>

  /**
   * Retrieves all app versions ordered by release date.
   */
  abstract findAll(page?: number, perPage?: number): Promise<AppVersion[]>

  /**
   * Finds an app version by its ID.
   * @param id
   */
  abstract findById(id: number): Promise<AppVersion | null>

  /**
   * Saves or updates an app version.
   * @param appVersion
   */
  abstract save(appVersion: AppVersion): Promise<AppVersion>

  /**
   * Deletes an app version.
   * @param appVersion
   */
  abstract delete(appVersion: AppVersion): Promise<void>
}
