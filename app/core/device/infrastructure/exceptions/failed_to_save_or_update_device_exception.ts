import { Exception } from '@adonisjs/core/exceptions'

export default class FailedToSaveOrUpdateDeviceException extends Exception {
  static status = 500
  static code = 'FAILED_TO_SAVE_OR_UPDATE_DEVICE'

  constructor() {
    super('Une erreur interne est survenue lors de la sauvegarde du device.', {
      status: FailedToSaveOrUpdateDeviceException.status,
      code: FailedToSaveOrUpdateDeviceException.code,
    })
  }
}
