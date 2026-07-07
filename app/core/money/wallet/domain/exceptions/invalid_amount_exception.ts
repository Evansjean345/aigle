import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidAmountException extends Exception {
  static status = 422
  static code = 'E_INVALID_AMOUNT'

  constructor(message: string = 'Montant invalide') {
    super(message, {
      status: InvalidAmountException.status,
      code: InvalidAmountException.code,
    })
  }
}
