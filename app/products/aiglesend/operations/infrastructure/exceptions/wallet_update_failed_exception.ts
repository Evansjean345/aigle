import { Exception } from '@adonisjs/core/exceptions'

export default class WalletUpdateFailedException extends Exception {
  static status = 500
  static code = 'WALLET_UPDATE_FAILED'

  constructor(message: string = 'Échec de la mise à jour du portefeuille') {
    super(message, {
      status: WalletUpdateFailedException.status,
      code: WalletUpdateFailedException.code,
    })
  }
}
