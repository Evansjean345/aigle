import { Exception } from '@adonisjs/core/exceptions'

export default class UnauthenticatedDeviceException extends Exception {
  static status = 401
  static code = 'E_UNAUTHENTICATED_DEVICE'

  constructor() {
    super(
      'Impossible d’authentifier cet appareil. Veuillez vous reconnecter ou contacter le support.',
      {
        status: UnauthenticatedDeviceException.status,
        code: UnauthenticatedDeviceException.code,
      }
    )
  }
}
