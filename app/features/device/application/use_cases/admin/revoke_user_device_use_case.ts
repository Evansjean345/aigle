import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'

@inject()
export default class RevokeUserDeviceUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {DeviceRepository} deviceRepository - A repository for managing device-related operations.
   * @param {UserRepository} userRepository - A repository for managing user-related operations.
   */
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * Executes the operation to revoke a device's access token and remove the device associated with the specified user.
   *
   * @param {string} userId - The unique identifier of the user whose device is being managed.
   * @param {string} deviceId - The unique identifier of the device to be revoked and deleted.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {UserAccountNotFoundException} If the user associated with the provided user ID does not exist.
   * @throws {DeviceNotFoundException} If the device does not exist or does not belong to the specified user.
   */
  async execute(userId: string, deviceId: string): Promise<void> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const device = await this.deviceRepository.findById(deviceId)

    if (!device || device.userId !== user.usersUid) {
      throw new DeviceNotFoundException()
    }

    const allTokens = await User.accessTokens.all(user)
    const deviceToken = allTokens.find((t) => t.name === `device:${device.id}`)

    if (deviceToken) {
      await User.accessTokens.delete(user, deviceToken.identifier)
    }

    // 2. Supprimer l'appareil
    await this.deviceRepository.deleteDevice(device)
  }
}
