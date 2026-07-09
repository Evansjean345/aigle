import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le canal `mobile` exige les informations d'appareil (`device_info`) au login pour
 * enregistrer et sécuriser l'appareil. Absent → 400. En canal `web`, l'appareil est
 * ignoré (pas d'erreur).
 */
export default class BusinessDeviceRequiredException extends Exception {
  static status = 400
  static code = 'E_DEVICE_REQUIRED'

  constructor(message: string = 'Les informations d’appareil sont requises pour le canal mobile.') {
    super(message, {
      status: BusinessDeviceRequiredException.status,
      code: BusinessDeviceRequiredException.code,
    })
  }
}
