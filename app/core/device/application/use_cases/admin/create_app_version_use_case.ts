import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/device/domain/interfaces/app_version_repository'
import AppVersion from '#core/device/domain/models/app_version'
import { DateTime } from 'luxon'
import AppVersionCacheService from '#core/device/infrastructure/services/app_version_cache_service'

@inject()
export default class CreateAppVersionUseCase {
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCacheService
  ) {}

  async execute(data: any): Promise<AppVersion> {
    const version = new AppVersion()
    version.merge({
      ...data,
      releaseDate: data.releaseDate
        ? DateTime.fromISO(data.releaseDate).toISODate()
        : DateTime.now().toISODate(),
    })
    const savedVersion = await this.appVersionRepository.save(version)

    // Invalidate cache for the specific platform
    await this.appVersionCacheService.invalidate(savedVersion.deviceType)

    return savedVersion
  }
}
