import { inject } from '@adonisjs/core'
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import { AdminDeviceDetailDto } from '#core/identity/device/application/dto/admin_device.dto'

@inject()
export default class GetDeviceDetailsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userDeviceRepository: UserDeviceRepository
  ) {}

  async execute(deviceId: string): Promise<AdminDeviceDetailDto> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device) {
      throw new DeviceNotFoundException()
    }

    const associations = await this.userDeviceRepository.findAllByDeviceIdWithUser(deviceId)
    return AdminDeviceDetailDto.fromDevice(device, associations)
  }
}
