import { Exception } from '@adonisjs/core/exceptions'

export default class MaxDevicesConnectedException extends Exception {
  static status = 429
  static code = 'MAX_DEVICES_CONNECTION_REACHED'

  constructor() {
    super(
      "Votre limite maximale d'appareils connectés est atteinte. Veuillez vous déconnecter d'un appareil avant de vous connecter à nouveau.",
      {
        status: MaxDevicesConnectedException.status,
        code: MaxDevicesConnectedException.code,
      }
    )
  }
}
