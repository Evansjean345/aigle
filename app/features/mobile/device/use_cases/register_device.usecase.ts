import DeviceService from '#shared/services/device_service'
import { inject } from '@adonisjs/core'
import { DeviceRequestDTO, DeviceResponseDTO } from '#mobile/device/dto/device.tdo'
import { toDeviceCommand } from '#mobile/device/mappers/device.mapper'
import User from '#shared/models/user'

@inject()
export default class RegisterDeviceUseCase {
  /**
   * Constructor¶
   * @param deviceService
   */
  constructor(private deviceService: DeviceService) {}

  /**
   *
   * @param deviceRequest
   * @param user
   */
  async execute(deviceRequest: DeviceRequestDTO, user: User): Promise<DeviceResponseDTO> {
    const deviceCommand = await toDeviceCommand(deviceRequest)
    const createdDevice = await this.deviceService.saveDevice(deviceCommand, user.usersUid)

    return {
      id: createdDevice.id,
    }
  }
}
