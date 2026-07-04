import { Exception } from '@adonisjs/core/exceptions'

export default class InsufficientFundsException extends Exception {
  static status = 400
  static code = 'E_INSUFFICIENT_FUNDS'

  constructor(
    message: string = "Vous n'avez pas de fonds suffisants pour effectuer cette opération"
  ) {
    super(message, {
      status: InsufficientFundsException.status,
      code: InsufficientFundsException.code,
    })
  }
}
