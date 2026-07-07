import { Exception } from '@adonisjs/core/exceptions'

export default class ExpiredTokenException extends Exception {
  static status = 400
  static code = 'E_EXPIRED_TOKEN'

  constructor(message: string = "Lien d'invitation expiré") {
    super(message, {
      status: ExpiredTokenException.status,
      code: ExpiredTokenException.code,
    })
  }
}
