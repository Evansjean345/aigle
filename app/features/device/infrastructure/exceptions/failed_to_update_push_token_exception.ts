import { Exception } from '@adonisjs/core/exceptions'

export default class FailedToUpdatePushTokenException extends Exception {
  static status = 500
  static code = 'FAILED_TO_UPDATE_PUSH_TOKEN'

  constructor() {
    super('Une erreur interne est survenue lors de la mise à jour du push token.', {
      status: FailedToUpdatePushTokenException.status,
      code: FailedToUpdatePushTokenException.code,
    })
  }
}
