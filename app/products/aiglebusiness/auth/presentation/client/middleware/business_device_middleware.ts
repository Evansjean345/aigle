import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { type DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import DeviceService from '#core/identity/device/application/services/device_service'
import { resolveRequiredChannel } from '#aiglebusiness/auth/presentation/client/middleware/business_channel_middleware'

/**
 * Middleware device **propre au business**. Lit le canal déclaré (`X-Client-Channel`)
 * et, en canal `mobile`, exige les headers device (`X-Device-Fingerprint`, `X-Device-Uid`).
 *
 * En plus de la présence des headers, **si une requête authentifiée** est mobile (routes
 * après login), l'appareil doit être **de confiance** (TRUSTED) pour l'utilisateur et
 * l'app `aiglebusiness` — un appareil inconnu, non lié ou non validé (PENDING/révoqué) est
 * refusé. Au `verify` (pré-token, l'appareil est justement en cours de validation) il n'y a
 * pas d'utilisateur authentifié → la vérification de trust est sautée.
 */
@inject()
export default class BusinessDeviceMiddleware {
  constructor(private readonly deviceService: DeviceService) {}

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

    // Action authentifiée en mobile → l'appareil doit être de confiance (pas seulement
    // les headers présents). Au verify (pas d'utilisateur authentifié) on ne vérifie pas.
    const authenticatedUserId = (ctx.auth?.user as { usersUid?: string } | undefined)?.usersUid

    if (channel === ClientChannel.MOBILE && authenticatedUserId) {
      await this.deviceService.assertTrustedForApp(
        authenticatedUserId,
        fingerprintHash!,
        deviceUid!,
        AppName.AIGLEBUSINESS,
        request.header('X-Device-Platform')
      )
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
