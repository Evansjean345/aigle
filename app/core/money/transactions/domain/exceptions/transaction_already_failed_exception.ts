import { Exception } from '@adonisjs/core/exceptions'

export default class TransactionAlreadyFailedException extends Exception {
  static status = 400
  static code = 'TRANSACTION_ALREADY_FAILED'

  constructor() {
    super('Transaction already failed', {
      status: TransactionAlreadyFailedException.status,
      code: TransactionAlreadyFailedException.code,
    })
  }
}
