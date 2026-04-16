import { Exception } from '@adonisjs/core/exceptions'

export default class TransactionAlreadyRefundedException extends Exception {
  static status = 409
  static code = 'E_TRANSACTION_ALREADY_REFUNDED'

  constructor() {
    super('Transaction already refunded', {
      status: TransactionAlreadyRefundedException.status,
      code: TransactionAlreadyRefundedException.code,
    })
  }
}
