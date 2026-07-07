import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import { inject } from '@adonisjs/core'
import {
  AdminDeviceFilters,
  AdminDeviceListItemDto,
} from '#core/identity/device/application/dto/admin_device.dto'

@inject()
export default class GetAllDevicesUseCase {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async execute(filters: AdminDeviceFilters): Promise<{
    data: AdminDeviceListItemDto[]
    meta: { total: number; page: number; perPage: number; lastPage: number }
  }> {
    const result = await this.deviceRepository.findAllPaginated(filters)

    return {
      data: result.data.map(AdminDeviceListItemDto.fromDevice),
      meta: result.meta,
    }
  }
}
