import { Exception } from '@adonisjs/core/exceptions'

export default class SameWalletTransferException extends Exception {
  static status = 400
  static code = 'SAME_WALLET_TRANSFER'

  constructor(message: string = 'Impossible de transférer vers le même portefeuille') {
    super(message, {
      status: SameWalletTransferException.status,
      code: SameWalletTransferException.code,
    })
  }
}
