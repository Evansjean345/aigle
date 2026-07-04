import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#core/device/application/services/device_service'
import { updatePushTokenValidator } from '#core/device/presentation/mobile/validators/device_validator'
import { DeviceResponseDTO } from '#core/device/application/dto/device.dto'
import RevokeDeviceUseCase from '#core/device/application/use_cases/mobile/revoke_device_use_case'

@inject()
export default class DeviceController {
  /**
   * Creates an instance of DeviceController.
   * @param {DeviceService} deviceService - Used for managing device-related operations.
   * @param {RevokeDeviceUseCase} revokeDeviceUseCase - Used for revoking device associations.
   */
  constructor(
    private readonly deviceService: DeviceService,
    private readonly revokeDeviceUseCase: RevokeDeviceUseCase
  ) {}

  /**
   * Retrieves the active devices associated with the authenticated user.
   *
   * @param {HttpContext} ctx - The HTTP context containing authentication and response information.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async getUserDevices({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const userDevices = await this.deviceService.getActiveUserDevices(user.usersUid)
    const deviceResponses = userDevices.map((ud) => DeviceResponseDTO.fromUserDevice(ud))

    return response.ok(deviceResponses)
  }

  /**
   * Revokes a device association for the authenticated user.
   *
   * @param {HttpContext} ctx - The HTTP context containing authentication, response, and request parameters.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async revokeDevice({ auth, response, params, request }: HttpContext): Promise<void> {
    const user = auth.user!
    const userDeviceId = params.id

    await this.revokeDeviceUseCase.execute(user, userDeviceId, {
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })

    return response.ok({ message: 'Device revoked successfully.' })
  }

  /**
   * Updates the push token for the authenticated user's device.
   *
   * @param {HttpContext} ctx - The HTTP context containing authentication, response, request parameters, and device information.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async updatePushToken({ request, response, auth, deviceInfo }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updatePushTokenValidator)
    const user = auth.user!

    const fingerprintHash = deviceInfo?.fingerprintHash
    const deviceUid = deviceInfo?.deviceUid

    if (!fingerprintHash || !deviceUid) {
      return response.badRequest({
        message: 'Fingerprint and Device UID are required in headers',
        code: 'DEVICE_IDENTIFIERS_REQUIRED',
      })
    }

    const userDevice = await this.deviceService.updatePushToken(
      fingerprintHash,
      deviceUid,
      payload.pushToken,
      user.usersUid
    )

    return response.ok({
      userDeviceId: userDevice.id,
      pushToken: userDevice.pushToken,
    })
  }
}
