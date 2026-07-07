import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import AppVersion from '#core/identity/device/domain/models/app_version'
import { DateTime } from 'luxon'
import AppVersionCache from '#core/identity/device/domain/interfaces/app_version_cache'

@inject()
export default class CreateAppVersionUseCase {
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCache
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
