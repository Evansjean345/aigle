import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand le retrait vise l'appareil principal.
 *
 * Le principal est le premier appareil lié pour une app. Le retirer reviendrait à se couper
 * l'accès depuis lequel on rétablit les autres.
 */
export default class CannotRevokePrimaryDeviceException extends Exception {
  static status = 403
  static code = 'E_CANNOT_REVOKE_PRIMARY_DEVICE'

  constructor(
    message: string = 'Vous ne pouvez pas supprimer votre appareil principal. Veuillez contacter le support si nécessaire.'
  ) {
    super(message, {
      status: CannotRevokePrimaryDeviceException.status,
      code: CannotRevokePrimaryDeviceException.code,
    })
  }
}
