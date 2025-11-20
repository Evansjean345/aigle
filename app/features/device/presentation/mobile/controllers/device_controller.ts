import { HttpContext } from '@adonisjs/core/http'
import RegisterDeviceUseCase from '#features/device/application/use_cases/register_device.usecase'
import { registerDeviceValidator } from '#features/device/presentation/mobile/validators/device_validator'
import { inject } from '@adonisjs/core'

@inject()
export default class DeviceController {
  /**
   * Initializes an instance of the class.
   *
   * @param {RegisterDeviceUseCase} registerDeviceUseCase - The use case instance for registering a device.
   */
  constructor(private readonly registerDeviceUseCase: RegisterDeviceUseCase) {}

  /**
   * Registers a device using the provided payload and authenticated user information.
   *
   * @param {Object} HttpContext - An object containing the HTTP context.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.auth - The authentication object containing user information.
   * @return {Promise<void>} Returns a promise that resolves with the created device's information.
   * @throws Will throw an error if validation or execution fails.
   */
  async registerDevice({ request, response, auth }: HttpContext): Promise<void> {
    try {
      const payload = await request.validateUsing(registerDeviceValidator)
      const result = await this.registerDeviceUseCase.execute(payload, auth.user!)

      return response.created(result)
    } catch (error) {
      throw error
    }
  }
}
