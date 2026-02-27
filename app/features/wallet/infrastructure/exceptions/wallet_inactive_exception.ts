import { Exception } from '@adonisjs/core/exceptions'

export default class WalletInactiveException extends Exception {
  static status = 403
  static code = 'E_WALLET_INACTIVE'

  constructor(
    message: string = 'Votre portefeuille est inactif. Veuillez contacter le service support.'
  ) {
    super(message, {
      status: WalletInactiveException.status,
      code: WalletInactiveException.code,
    })
  }
}
