import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidResetTokenException extends Exception {
  static status = 400
  static code = 'INVALID_RESET_TOKEN'

  constructor(message: string = 'Le jeton de réinitialisation est invalide ou a expiré') {
    super(message, {
      status: InvalidResetTokenException.status,
      code: InvalidResetTokenException.code,
    })
  }
}
