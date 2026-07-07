import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import { DeviceType } from '#core/identity/device/domain/enums'
import AppVersionCache from '#core/identity/device/domain/interfaces/app_version_cache'

export enum UpdateStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  OBSOLETE = 'OBSOLETE',
}

@inject()
export default class CheckAppUpdateUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AppVersionRepository} appVersionRepository - The repository to manage application version data.
   * @param {AppVersionCache} appVersionCacheService
   */
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCache
  ) {}

  /**
   * Executes a version check and determines if an update is required or if the current version is obsolete.
   *
   * @param {string} currentVersion - The current version of the application.
   * @param {DeviceType} platform - The platform of the application ('ios' or 'android').
   * @return {Promise<Record<string, any>>} A promise that resolves with an object containing the update status and additional metadata.
   * The status can be:
   * - `UpdateStatus.UP_TO_DATE`: Indicates the app is up to date.
   * - `UpdateStatus.OBSOLETE`: Indicates the app version is no longer supported.
   * - `UpdateStatus.UPDATE_AVAILABLE`: Indicates a newer version is available.
   */
  async execute(currentVersion: string, platform: DeviceType): Promise<Record<string, any>> {
    const latestConfig = await this.appVersionCacheService.getLatest(platform, () =>
      this.appVersionRepository.findLatestByDeviceType(platform)
    )

    if (!latestConfig) {
      return { status: UpdateStatus.UP_TO_DATE }
    }

    const isObsolete = this.compareVersions(currentVersion, latestConfig.minVersion) < 0
    const hasUpdate = this.compareVersions(currentVersion, latestConfig.versionNumber) < 0

    if (isObsolete) {
      return {
        status: UpdateStatus.OBSOLETE,
        message: "Cette version n'est plus supportée. Veuillez mettre à jour pour continuer.",
        currentVersion,
        minVersion: latestConfig.minVersion,
        latestVersion: latestConfig.versionNumber,
        downloadUrl: latestConfig.downloadUrl,
      }
    }

    if (hasUpdate) {
      return {
        status: UpdateStatus.UPDATE_AVAILABLE,
        critical: latestConfig.criticalUpdate,
        latestVersion: latestConfig.versionNumber,
        changelog: latestConfig.changelog,
        downloadUrl: latestConfig.downloadUrl,
        releaseDate: latestConfig.releaseDate,
      }
    }

    return { status: UpdateStatus.UP_TO_DATE }
  }

  /**
   * Compares two version strings and determines their relative order.
   *
   * @param {string} v1 - The first version string to compare.
   * @param {string} v2 - The second version string to compare.
   * @return {number} A negative number if v1 is less than v2, a positive number if v1 is greater than v2, and 0 if they are equal.
   */
  private compareVersions(v1: string, v2: string): number {
    return v1.localeCompare(v2, undefined, { numeric: true, sensitivity: 'base' })
  }
}
