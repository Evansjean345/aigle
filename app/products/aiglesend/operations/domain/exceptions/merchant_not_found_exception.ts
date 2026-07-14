import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand le code marchand scanné (alias payable du QR) ne correspond à aucun marchand.
 */
export default class MerchantNotFoundException extends Exception {
  static status = 404
  static code = 'E_MERCHANT_NOT_FOUND'

  constructor(message: string = 'Marchand introuvable pour ce code.') {
    super(message, {
      status: MerchantNotFoundException.status,
      code: MerchantNotFoundException.code,
    })
  }
}
