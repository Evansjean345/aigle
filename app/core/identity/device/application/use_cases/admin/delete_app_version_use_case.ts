import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import AppVersionNotFoundException from '#core/identity/device/domain/exceptions/app_version_not_found_exception'
import AppVersionCache from '#core/identity/device/domain/interfaces/app_version_cache'

@inject()
export default class DeleteAppVersionUseCase {
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCache
  ) {}

  async execute(id: number): Promise<void> {
    const version = await this.appVersionRepository.findById(id)
    if (!version) {
      throw new AppVersionNotFoundException()
    }
    const deviceType = version.deviceType
    await this.appVersionRepository.delete(version)

    // Invalidate cache for the specific platform
    await this.appVersionCacheService.invalidate(deviceType)
  }
}
