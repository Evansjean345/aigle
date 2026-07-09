/**
 * Informations d'appareil extraites des en-têtes HTTP. Type **feuille** (sans couche) :
 * le middleware qui les peuple et valide le trust vit dans
 * `core/identity/device/presentation` (il dépend de DeviceService).
 */
export interface DeviceHeadersInfo {
  fingerprintHash: string
  deviceUid: string
  platform: string | null
  appVersion: string | null
  osVersion: string | null
}

/**
 * Étend le HttpContext pour inclure les informations device.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    deviceInfo?: DeviceHeadersInfo
  }
}
