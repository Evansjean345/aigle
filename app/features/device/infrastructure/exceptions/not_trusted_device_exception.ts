import { Exception } from '@adonisjs/core/exceptions'

export default class NotTrustedDeviceException extends Exception {
  static status = 403
  static code = 'NOT_TRUSTED_DEVICE'

  constructor() {
    super("Cet appareil n'est pas autorisé. Veuillez-vous reconnecter pour l'autoriser.", {
      status: NotTrustedDeviceException.status,
      code: NotTrustedDeviceException.code,
    })
  }
}
