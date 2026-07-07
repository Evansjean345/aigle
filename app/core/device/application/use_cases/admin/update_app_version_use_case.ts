import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/device/domain/interfaces/app_version_repository'
import AppVersion from '#core/device/domain/models/app_version'
import { DateTime } from 'luxon'
import AppVersionNotFoundException from '#core/device/domain/exceptions/app_version_not_found_exception'
import AppVersionCacheService from '#core/device/infrastructure/services/app_version_cache_service'

@inject()
export default class UpdateAppVersionUseCase {
  /**
   * Initializes a new instance of the class with the specified AppVersionRepository.
   *
   * @param {AppVersionRepository} appVersionRepository - The repository instance responsible for managing app version data.
   * @param {AppVersionCacheService} appVersionCacheService
   */
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCacheService
  ) {}

  /**
   * Executes the update process for an app version by its unique identifier.
   *
   * @param {number} id - The unique identifier of the app version to update.
   * @param {any} data - The data containing the updates to be applied to the app version.
   * @return {Promise<AppVersion>} A promise that resolves with the updated app version.
   * @throws {AppVersionNotFoundException} If no app version is found with the provided identifier.
   */
  async execute(id: number, data: Record<string, any>): Promise<AppVersion> {
    const version = await this.appVersionRepository.findById(id)
    if (!version) {
      throw new AppVersionNotFoundException()
    }

    const oldDeviceType = version.deviceType

    if (data.releaseDate) {
      data.releaseDate = DateTime.fromISO(data.releaseDate).toISODate()
    }

    version.merge(data)
    const updatedVersion = await this.appVersionRepository.save(version)

    // Invalidate cache for the old platform and the new one if changed
    await this.appVersionCacheService.invalidate(oldDeviceType)
    if (updatedVersion.deviceType !== oldDeviceType) {
      await this.appVersionCacheService.invalidate(updatedVersion.deviceType)
    }

    return updatedVersion
  }
}
