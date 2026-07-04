import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import User from '#core/user/domain/models/user'
import UserDeviceRepository from '#core/device/domain/interfaces/user_device_repository'
import DeviceNotFoundException from '#core/device/infrastructure/exceptions/device_not_found_exception'
import { DeviceStatus } from '#core/device/domain/enums'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

export interface RevokeDeviceAuditContext {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

@inject()
export default class RevokeDeviceUseCase {
  constructor(private readonly userDeviceRepository: UserDeviceRepository) {}

  async execute(
    user: User,
    userDeviceId: string,
    auditContext?: RevokeDeviceAuditContext
  ): Promise<void> {
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

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'DEVICE_REVOKED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'UserDevice',
        targetId: String(userDevice.id),
        result: AuditResult.SUCCESS,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: auditContext?.userAgent ?? null,
        requestId: auditContext?.requestId ?? null,
        metadata: { deviceId: userDevice.deviceId ?? null, wasPrimary: userDevice.isPrimary },
      })
      .catch((_) => {})
  }
}
