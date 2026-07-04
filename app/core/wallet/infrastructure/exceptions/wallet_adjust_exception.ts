import { Exception } from '@adonisjs/core/exceptions'

export default class WalletAdjustException extends Exception {
  static status = 500
  static code = 'WALLET_ADJUST_FAILED'

  constructor(message: string = "Erreur lors de l'ajustement du portefeuille") {
    super(message, {
      status: WalletAdjustException.status,
      code: WalletAdjustException.code,
    })
  }
}
