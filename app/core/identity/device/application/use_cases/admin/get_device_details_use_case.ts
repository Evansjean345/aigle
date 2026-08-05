import { inject } from '@adonisjs/core'
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import DeviceService from '#core/identity/device/application/services/device_service'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import {
  AdminDeviceDetailDto,
  AdminDeviceSiblingDto,
} from '#core/identity/device/application/dto/admin_device.dto'

/**
 * Fiche d'une installation, avec les autres installations du même téléphone.
 *
 * Le back-office regarde un matériel, mais la table en tient une ligne par application : sans ce
 * rapprochement, un même téléphone y apparaît comme deux appareils sans lien.
 */
@inject()
export default class GetDeviceDetailsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userDeviceRepository: UserDeviceRepository,
    private readonly deviceService: DeviceService
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} deviceId - Installation consultée.
   * @returns {Promise<AdminDeviceDetailDto>} La fiche, ses liaisons et ses installations jumelles.
   * @throws {DeviceNotFoundException} Identifiant inconnu.
   */
  async execute(deviceId: string): Promise<AdminDeviceDetailDto> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device) {
      throw new DeviceNotFoundException()
    }

    const associations = await this.userDeviceRepository.findAllByDeviceIdWithUser(deviceId)
    const siblings = await this.deviceService.findSiblingInstallations(deviceId)

    const siblingViews = await Promise.all(
      siblings.map(async (sibling) =>
        AdminDeviceSiblingDto.from(
          sibling,
          await this.userDeviceRepository.findActiveByDeviceId(sibling.id)
        )
      )
    )

    return AdminDeviceDetailDto.fromDevice(device, associations, siblingViews)
  }
}
