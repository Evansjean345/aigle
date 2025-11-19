import { HttpContext } from '@adonisjs/core/http'
import RegisterDeviceUseCase from '../../../application/use_cases/register_device.usecase.js'
import { registerDeviceValidator } from '../../../application/validators/device_validator.js'
import { inject } from '@adonisjs/core'

@inject()
export default class DeviceController {
  /**
   * Creates an instance of DeviceController.
   * @param registerDeviceUseCase
   */
  constructor(private readonly registerDeviceUseCase: RegisterDeviceUseCase) {}

  /**
   * Register a device
   * @param request
   * @param response
   */
  async registerDevice({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(registerDeviceValidator)
      const result = await this.registerDeviceUseCase.execute(payload, auth.user!)

      return response.created(result)
    } catch (error) {
      throw error
    }
  }
}
