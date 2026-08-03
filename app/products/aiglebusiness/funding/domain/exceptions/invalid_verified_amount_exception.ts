import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le montant vérifié n'est pas un entier strictement positif.
 */
export default class InvalidVerifiedAmountException extends Exception {
  static status = 422
  static code = 'E_INVALID_VERIFIED_AMOUNT'

  constructor() {
    super('Le montant vérifié doit être un entier strictement positif.', {
      status: 422,
      code: 'E_INVALID_VERIFIED_AMOUNT',
    })
  }
}
