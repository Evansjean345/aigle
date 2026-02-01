import { Exception } from '@adonisjs/core/exceptions'

export default class UnregisteredAccountException extends Exception {
  static status = 400
  static code = 'E_UNREGISTERED_ACCOUNT'

  constructor(message: string = "Ce numéro n'est pas un compte Aigle send") {
    super(message, {
      status: UnregisteredAccountException.status,
      code: UnregisteredAccountException.code,
    })
  }
}
