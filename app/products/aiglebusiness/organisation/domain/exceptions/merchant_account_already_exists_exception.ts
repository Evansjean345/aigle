import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand un utilisateur tente de créer un second compte marchand
 * (contrainte multi-org : ≤ 1 marchand par user ; les entreprises sont
 * illimitées, §4.3).
 */
export default class MerchantAccountAlreadyExistsException extends Exception {
  static status = 409
  static code = 'E_MERCHANT_ACCOUNT_ALREADY_EXISTS'

  constructor(message: string = 'Vous possédez déjà un compte marchand') {
    super(message, {
      status: MerchantAccountAlreadyExistsException.status,
      code: MerchantAccountAlreadyExistsException.code,
    })
  }
}
