import { Exception } from '@adonisjs/core/exceptions'

export default class AccountBlockedException extends Exception {
  static status = 401
  static code = 'ACCOUNT_BLOCKED'

  constructor(
    message: string = "Votre compte est suspendu. Veuillez contacter le support pour plus d'informations."
  ) {
    super(message, {
      status: AccountBlockedException.status,
      code: AccountBlockedException.code,
    })
  }
}
