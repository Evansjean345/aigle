import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Middleware d'appareil des routes mobiles aiglesend : extrait les en-têtes device.
 *
 * En plus d'extraire les en-têtes, **si la requête est authentifiée** (routes après login),
 * l'appareil doit être **de confiance** (existe, sûr, TRUSTED) pour l'utilisateur et l'app
 * `aiglesend` — un appareil inconnu/non sûr/non validé est refusé. Les étapes pré-token
 * (verify-account, send-otp, forgot-password) n'ont pas d'utilisateur authentifié → la
 * vérification de trust est sautée (l'appareil y est justement en cours de validation).
 *
 * Vit dans `core/identity/device/presentation` (dépend de DeviceService, core) — le type
 * `DeviceHeadersInfo` reste dans `shared` (feuille, sans couche).
 */
@inject()
export default class DeviceMiddleware {
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Extrait les informations du device depuis les headers HTTP.
   *
   * @param {HttpContext} ctx - Le contexte HTTP
   * @param {NextFn} next - La fonction suivante dans la chaîne de middleware
   * @param {Object} options - Options du middleware
   * @param {boolean} options.required - Si true, les headers requis doivent être présents (défaut: true)
   */
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      required?: boolean
    } = {
      required: true,
    }
  ) {
    const { request } = ctx
    const required = options.required !== false

    const fingerprintHash = request.header('X-Device-Fingerprint')
    const deviceUid = request.header('X-Device-Uid')

    if (required) {
      const missingHeaders: string[] = []

      if (!fingerprintHash) {
        missingHeaders.push('X-Device-Fingerprint')
      }
      if (!deviceUid) {
        missingHeaders.push('X-Device-Uid')
      }

      if (missingHeaders.length > 0) {
        throw new Exception(`Missing required device headers: ${missingHeaders.join(', ')}`, {
          status: 400,
          code: 'MISSING_DEVICE_HEADERS',
        })
      }
    }

    if (fingerprintHash || deviceUid) {
      ctx.deviceInfo = {
        fingerprintHash: fingerprintHash || '',
        deviceUid: deviceUid || '',
        platform: request.header('X-Device-Platform') || null,
        appVersion: request.header('X-App-Version') || null,
        osVersion: request.header('X-Device-Os-Version') || null,
      }
    } else {
      ctx.deviceInfo = {
        fingerprintHash: '',
        deviceUid: '',
        platform: null,
        appVersion: null,
        osVersion: null,
      }
    }

    // Requête authentifiée avec un appareil déclaré → l'appareil doit être de confiance.
    // Les flux pré-token (verify-account, send-otp, forgot-password) n'ont pas d'utilisateur
    // authentifié → sautés (l'appareil y est en cours de validation).
    const authenticatedUserId = (ctx.auth?.user as { usersUid?: string } | undefined)?.usersUid

    if (authenticatedUserId && fingerprintHash && deviceUid) {
      await this.deviceService.assertTrustedForApp(
        authenticatedUserId,
        fingerprintHash,
        deviceUid,
        AppName.AIGLESEND,
        request.header('X-Device-Platform')
      )
    }

    return next()
  }
}
