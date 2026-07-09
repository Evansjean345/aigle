import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { type DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'
import { resolveRequiredChannel } from '#aiglebusiness/auth/presentation/client/middleware/business_channel_middleware'

export default class BusinessDeviceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request } = ctx
    const channel = resolveRequiredChannel(ctx)

    const fingerprintHash = request.header('X-Device-Fingerprint')
    const deviceUid = request.header('X-Device-Uid')

    if (channel === ClientChannel.MOBILE && (!fingerprintHash || !deviceUid)) {
      throw new Exception('Appareil requis pour le canal mobile', {
        status: 400,
        code: 'E_DEVICE_REQUIRED',
      })
    }

    ctx.clientChannel = channel
    ctx.deviceInfo = {
      fingerprintHash: fingerprintHash || '',
      deviceUid: deviceUid || '',
      platform: request.header('X-Device-Platform') || null,
      appVersion: request.header('X-App-Version') || null,
      osVersion: request.header('X-Device-Os-Version') || null,
    }

    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    clientChannel?: ClientChannel
    deviceInfo?: DeviceHeadersInfo
  }
}
