import DeviceService from '../services/device_service.js'
import { inject } from '@adonisjs/core'
import { DeviceRequestDTO, DeviceResponseDTO } from '../dto/device.tdo.js'
import { toDeviceCommand } from '../mappers/device.mapper.js'
import User from '#features/authentication/domain/models/user'

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
