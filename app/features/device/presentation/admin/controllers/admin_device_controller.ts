import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#features/device/application/services/device_service'
import RevokeUserDeviceUseCase from '#features/device/application/use_cases/admin/revoke_user_device_use_case'
import { toDeviceResponse } from '#features/device/application/mappers/device.mapper'

@inject()
export default class AdminDeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly revokeUserDeviceUseCase: RevokeUserDeviceUseCase
  ) {}

  /**
   * Liste tous les appareils d'un utilisateur spécifique.
   */
  async getUserDevices({ params, response }: HttpContext) {
    const userId = params.userId
    const devices = await this.deviceService.getDeviceByUserId(userId)
    return response.ok(devices.map((d) => toDeviceResponse(d)))
  }

  /**
   * Révoque un appareil spécifique pour un utilisateur.
   */
  async revokeDevice({ params, response }: HttpContext) {
    const { userId, deviceId } = params
    await this.revokeUserDeviceUseCase.execute(userId, deviceId)
    return response.noContent()
  }
}
