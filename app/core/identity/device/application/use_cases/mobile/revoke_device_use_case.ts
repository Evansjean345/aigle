import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import User from '#core/identity/user/domain/models/user'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import DeviceNotFoundException from '#core/identity/device/domain/exceptions/device_not_found_exception'
import CannotRevokePrimaryDeviceException from '#core/identity/device/domain/exceptions/cannot_revoke_primary_device_exception'
import { DeviceStatus } from '#core/identity/device/domain/enums'
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
      throw new CannotRevokePrimaryDeviceException()
    }

    const allTokens = await User.accessTokens.all(user)
    const deviceToken = allTokens.find((t) => t.name === `device:${userDevice.id}`)

    if (deviceToken) {
      await User.accessTokens.delete(user, deviceToken.identifier)
    }

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
