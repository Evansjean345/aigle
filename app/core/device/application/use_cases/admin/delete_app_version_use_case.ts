import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/device/domain/interfaces/app_version_repository'
import AppVersionNotFoundException from '#core/device/domain/exceptions/app_version_not_found_exception'
import AppVersionCacheService from '#core/device/infrastructure/services/app_version_cache_service'

@inject()
export default class DeleteAppVersionUseCase {
  constructor(
    private appVersionRepository: AppVersionRepository,
    private appVersionCacheService: AppVersionCacheService
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
