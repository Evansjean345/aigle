import { Exception } from '@adonisjs/core/exceptions'

export default class TransactionNotFoundException extends Exception {
  static status = 404
  static code = 'TRANSACTION_NOT_FOUND'

  constructor(message: string = 'Transaction not found') {
    super(message, {
      status: TransactionNotFoundException.status,
      code: TransactionNotFoundException.code,
    })
  }
}
