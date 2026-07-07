import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CheckAppUpdateUseCase from '#core/identity/device/application/use_cases/mobile/check_app_update_use_case'
import { checkUpdateValidator } from '#core/identity/device/presentation/mobile/validators/app_version_validator'

@inject()
export default class AppVersionController {
  /**
   * Creates an instance of the class with the specified dependencies.
   *
   * @param {CheckAppUpdateUseCase} checkAppUpdateUseCase - The use case instance responsible for checking app updates.
   */
  constructor(private checkAppUpdateUseCase: CheckAppUpdateUseCase) {}

  /**
   * Performs an update check based on the platform and version provided in the request.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object containing client data.
   * @param {Object} context.response - The HTTP response object used to send the server response.
   * @return {Promise<void>} A promise that resolves with the update information.
   */
  async check({ request, response }: HttpContext): Promise<void> {
    const { platform, version } = await request.validateUsing(checkUpdateValidator)

    const updateInfo = await this.checkAppUpdateUseCase.execute(version, platform)
    return response.ok(updateInfo)
  }
}
