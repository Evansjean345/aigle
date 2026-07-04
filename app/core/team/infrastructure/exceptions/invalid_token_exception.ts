import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidTokenException extends Exception {
  static status = 400
  static code = 'E_INVALID_TOKEN'

  constructor(message: string = "Lien d'invitation invalide") {
    super(message, {
      status: InvalidTokenException.status,
      code: InvalidTokenException.code,
    })
  }
}
