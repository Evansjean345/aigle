import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#features/device/application/services/device_service'
import RevokeUserDeviceUseCase from '#features/device/application/use_cases/admin/revoke_user_device_use_case'
import { toDeviceResponse } from '#features/device/application/mappers/device.mapper'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class AdminDeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly revokeUserDeviceUseCase: RevokeUserDeviceUseCase
  ) {}

  /**
   * Liste tous les appareils d'un utilisateur spécifique.
   */
  async getUserDevices({ params, response, auth, request }: HttpContext) {
    const userId = params.userId
    const devices = await this.deviceService.getDeviceByUserId(userId)

    await emitter.emit('activity:audit', {
      eventCategory: 'DEVICE',
      eventAction: 'READ_USER_DEVICES',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      targetType: 'user',
      targetId: userId,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      result: AuditResult.SUCCESS,
    })

    return response.ok(devices.map((d) => toDeviceResponse(d)))
  }

  /**
   * Révoque un appareil spécifique pour un utilisateur.
   */
  async revokeDevice({ params, response, auth, request }: HttpContext) {
    const { userId, deviceId } = params
    try {
      await this.revokeUserDeviceUseCase.execute(userId, deviceId)

      await emitter.emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'REVOKE_USER_DEVICE',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: userId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: { deviceId },
        result: AuditResult.SUCCESS,
      })

      return response.noContent()
    } catch (error) {
      await emitter.emit('activity:audit', {
        eventCategory: 'DEVICE',
        eventAction: 'REVOKE_USER_DEVICE',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: userId,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: { deviceId },
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message,
      })
      throw error
    }
  }
}
