import { inject } from '@adonisjs/core'
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import { AdminDeviceAccountDto } from '#core/identity/device/application/dtos/admin/admin_device.dto'

@inject()
export default class GetDeviceAccountsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userDeviceRepository: UserDeviceRepository
  ) {}

  async execute(
    deviceId: string,
    status: 'active' | 'all' = 'all'
  ): Promise<AdminDeviceAccountDto[]> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device) {
      throw new DeviceNotFoundException()
    }

    const activeOnly = status === 'active'
    const associations = await this.userDeviceRepository.findAllByDeviceIdWithUser(
      deviceId,
      activeOnly
    )

    return associations.map(AdminDeviceAccountDto.fromUserDevice)
  }
}
