import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import User from '#features/user/domain/models/user'
import UserDeviceRepository from '#features/device/domain/interfaces/user_device_repository'
import DeviceNotFoundException from '#features/device/infrastructure/exceptions/device_not_found_exception'
import { DeviceStatus } from '#features/device/domain/enums'

@inject()
export default class RevokeDeviceUseCase {
  constructor(private readonly userDeviceRepository: UserDeviceRepository) {}

  async execute(user: User, userDeviceId: string): Promise<void> {
    const userDevice = await this.userDeviceRepository.findById(userDeviceId)

    if (!userDevice || userDevice.userId !== user.usersUid) {
      throw new DeviceNotFoundException()
    }

    if (userDevice.isPrimary) {
      throw new Exception(
        'Vous ne pouvez pas supprimer votre appareil principal. Veuillez contacter le support si nécessaire.',
        {
          status: 403,
          code: 'E_CANNOT_REVOKE_PRIMARY_DEVICE',
        }
      )
    }

    // Révoquer le token d'accès associé
    const allTokens = await User.accessTokens.all(user)
    const deviceToken = allTokens.find((t) => t.name === `device:${userDevice.id}`)

    if (deviceToken) {
      await User.accessTokens.delete(user, deviceToken.identifier)
    }

    // Révoquer la liaison
    userDevice.status = DeviceStatus.REVOKED
    userDevice.unlinkedAt = DateTime.now()
    await this.userDeviceRepository.save(userDevice)
  }
}
