import { Exception } from '@adonisjs/core/exceptions'

export default class DeviceNotFoundException extends Exception {
  static status = 404
  static code = 'E_DEVICE_NOT_FOUND'

  constructor() {
    super('Appareil non trouvé.', {
      status: DeviceNotFoundException.status,
      code: DeviceNotFoundException.code,
    })
  }
}
