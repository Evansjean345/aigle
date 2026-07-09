import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import { type DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import {
  ClientChannel,
  CLIENT_CHANNEL_HEADER,
  isValidChannel,
} from '#core/identity/authentication/domain/enums/client_channel'

/**
 * Middleware device **propre au business** (ne pas mélanger avec celui d'aiglesend,
 * mobile-only). Le business sert deux canaux ; ce middleware lit le canal déclaré
 * (`X-Client-Channel`) et **exige l'appareil selon le canal** :
 *  - `mobile` → headers device (`X-Device-Fingerprint`, `X-Device-Uid`) requis (400 sinon) ;
 *  - `web`    → device non requis.
 * Le canal est **obligatoire** (400 s'il manque ou est invalide) pour une distinction
 * explicite. Peuple `ctx.clientChannel` + `ctx.deviceInfo`.
 */
export default class BusinessDeviceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request } = ctx
    const rawChannel = request.header(CLIENT_CHANNEL_HEADER)

    if (!rawChannel || !isValidChannel(rawChannel)) {
      throw new Exception(`Header ${CLIENT_CHANNEL_HEADER} requis (mobile|web)`, {
        status: 400,
        code: 'E_CHANNEL_REQUIRED',
      })
    }

    const channel = rawChannel
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
