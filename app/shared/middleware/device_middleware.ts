import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Interface pour les informations device extraites des headers
 */
export interface DeviceHeadersInfo {
  fingerprintHash: string
  deviceUid: string
  platform: string | null
  appVersion: string | null
  osVersion: string | null,
  ipAddress: string | null
}

/**
 * Étend le HttpContext pour inclure les informations device
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    deviceInfo?: DeviceHeadersInfo
  }
}

/**
 * DeviceMiddleware est utilisé pour extraire et valider les informations
 * du device depuis les headers HTTP.
 *
 * Headers attendus:
 * - X-Device-Fingerprint (requis): Hash unique de l'appareil
 * - X-Device-Uid (requis): UUID de l'installation de l'app
 * - X-Device-Platform (optionnel): Plateforme (ios/android)
 * - X-App-Version (optionnel): Version de l'application
 * - X-Device-Os-Version (optionnel): Version du système d'exploitation
 */
export default class DeviceMiddleware {
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
        ipAddress: request.ip() || null,
      }
    }

    return next()
  }
}
