import { inject } from '@adonisjs/core'
import AppVersionRepository from '#core/identity/device/domain/interfaces/app_version_repository'
import AppVersion from '#core/identity/device/domain/models/app_version'

@inject()
export default class GetAllAppVersionsUseCase {
  constructor(private appVersionRepository: AppVersionRepository) {}

  async execute(): Promise<AppVersion[]> {
    return this.appVersionRepository.findAll()
  }
}
