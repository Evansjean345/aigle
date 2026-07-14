import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand le marchand ciblé (alias payable désactivé) n'accepte pas les paiements.
 */
export default class MerchantInactiveException extends Exception {
  static status = 409
  static code = 'E_MERCHANT_INACTIVE'

  constructor(message: string = "Ce marchand n'accepte pas les paiements pour le moment.") {
    super(message, {
      status: MerchantInactiveException.status,
      code: MerchantInactiveException.code,
    })
  }
}
