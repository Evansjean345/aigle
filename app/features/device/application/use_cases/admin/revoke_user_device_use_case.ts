import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import DeviceService from '#features/device/application/services/device_service'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'

@inject()
export default class RevokeUserDeviceUseCase {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly userRepository: UserRepository
  ) {}

  async execute(userId: string, deviceId: string): Promise<void> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const userDevice = await this.deviceService.revokeDevice(user.usersUid, deviceId)

    if (!userDevice) {
      throw new DeviceNotFoundException()
    }

    // Révoquer le token d'accès associé
    const allTokens = await User.accessTokens.all(user)
    const deviceToken = allTokens.find((t) => t.name === `device:${userDevice.id}`)

    if (deviceToken) {
      await User.accessTokens.delete(user, deviceToken.identifier)
    }
  }
}
