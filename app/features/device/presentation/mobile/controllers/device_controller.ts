import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#features/device/application/services/device_service'
import { updatePushTokenValidator } from '#features/device/presentation/mobile/validators/device_validator'
import { toDeviceResponse } from '#features/device/application/mappers/device.mapper'
import RevokeDeviceUseCase from '#features/device/application/use_cases/mobile/revoke_device_use_case'

/**
 * DeviceController gère les opérations liées aux devices mobiles.
 */
@inject()
export default class DeviceController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {DeviceService} deviceService - An instance of the DeviceService used for managing device-related operations.
   * @param {RevokeDeviceUseCase} revokeDeviceUseCase
   */
  constructor(
    private deviceService: DeviceService,
    private revokeDeviceUseCase: RevokeDeviceUseCase
  ) {}

  /**
   * Fetches and returns the devices associated with the authenticated user.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.auth - The authentication object containing the authenticated user's information.
   * @param {Object} context.response - The response object used to send the results.
   * @return {Promise<void>} Resolves when the device data has been fetched and the response is sent.
   */
  async getUserDevices({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const devices = await this.deviceService.getDeviceByUserId(user.usersUid)
    const deviceResponses = devices.map((device) => toDeviceResponse(device))

    return response.ok(deviceResponses)
  }

  /**
   * Révoque un appareil spécifique pour l'utilisateur authentifié.
   *
   * @param context
   */
  async revokeDevice({ auth, response, params }: HttpContext): Promise<void> {
    const user = auth.user!
    const deviceId = params.id

    await this.revokeDeviceUseCase.execute(user, deviceId)

    return response.ok({message: 'Device revoked successfully.'})
  }

  /**
   * Updates the push token for a user's device using the provided fingerprint hash.
   *
   * @param {Object} context - The HTTP context object containing request, response, auth, and deviceInfo.
   * @param {Request} context.request - The HTTP request object.
   * @param {Response} context.response - The HTTP response object.
   * @param {AuthContract} context.auth - The authentication object providing user information.
   * @param {Object} context.deviceInfo - Object containing device-related information such as fingerprintHash.
   * @return {Promise<void>} Resolves successfully when the push token is updated or returns an error response if validation fails.
   */
  async updatePushToken({ request, response, auth, deviceInfo }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updatePushTokenValidator)
    const user = auth.user!

    // Récupérer le fingerprint et deviceUid depuis le header (via middleware device)
    const fingerprintHash = deviceInfo?.fingerprintHash
    const deviceUid = deviceInfo?.deviceUid

    if (!fingerprintHash || !deviceUid) {
      return response.badRequest({
        message: 'Fingerprint and Device UID are required in headers',
        code: 'DEVICE_IDENTIFIERS_REQUIRED',
      })
    }

    const device = await this.deviceService.updatePushTokenByFingerprintAndUid(
      fingerprintHash,
      deviceUid,
      payload.pushToken,
      user.usersUid
    )

    return response.ok({
      deviceId: device.id,
      pushToken: device.pushToken,
    })
  }
}
