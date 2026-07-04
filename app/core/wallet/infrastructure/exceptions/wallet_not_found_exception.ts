import { Exception } from '@adonisjs/core/exceptions'

export default class WalletNotFoundException extends Exception {
  static status = 404
  static code = 'E_WALLET_NOT_FOUND'

  constructor(message: string = 'Portefeuille introuvable') {
    super(message, {
      status: WalletNotFoundException.status,
      code: WalletNotFoundException.code,
    })
  }
}
