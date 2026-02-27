import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#features/user/domain/models/user'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'

@inject()
export default class RevokeDeviceUseCase {
  /**
   * Constructor for initializing dependencies required by the class.
   *
   * @param {DeviceRepository} deviceRepository - The repository responsible for handling device data persistence.
   */
  constructor(private readonly deviceRepository: DeviceRepository) {}

  /**
   * Executes the process of disconnecting a device token and removing the specified device.
   *
   * @param {User} user The user performing the operation.
   * @param {string} deviceId The unique identifier of the device to be removed.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {DeviceNotFoundException} If the specified device is not found or does not belong to the user.
   * @throws {Exception} If the device is the primary device.
   */
  async execute(user: User, deviceId: string): Promise<void> {
    const device = await this.deviceRepository.findById(deviceId)

    if (!device || device.userId !== user.usersUid) {
      throw new DeviceNotFoundException()
    }

    if (device.isPrimary) {
      throw new Exception(
        'Vous ne pouvez pas supprimer votre appareil principal. Veuillez contacter le support si nécessaire.',
        {
          status: 403,
          code: 'E_CANNOT_REVOKE_PRIMARY_DEVICE',
        }
      )
    }

    const allTokens = await User.accessTokens.all(user)
    const deviceToken = allTokens.find((t) => t.name === `device:${device.id}`)

    if (deviceToken) {
      await User.accessTokens.delete(user, deviceToken.identifier)
    }

    await this.deviceRepository.deleteDevice(device)
  }
}
