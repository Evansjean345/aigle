import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import AppVersion from '#core/identity/device/domain/models/app_version'
import AppVersionNotFoundException from '#core/identity/device/domain/exceptions/app_version_not_found_exception'

@inject()
export default class GetAppVersionDetailsUseCase {
  constructor(private appVersionRepository: AppVersionRepository) {}

  async execute(id: number): Promise<AppVersion> {
    const version = await this.appVersionRepository.findById(id)
    if (!version) {
      throw new AppVersionNotFoundException()
    }
    return version
  }
}
