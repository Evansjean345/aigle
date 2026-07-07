import { Exception } from '@adonisjs/core/exceptions'

export default class TransactionAlreadySuccessfulException extends Exception {
  static status = 400
  static code = 'TRANSACTION_ALREADY_SUCCESSFUL'

  constructor() {
    super('Transaction already successful', {
      status: TransactionAlreadySuccessfulException.status,
      code: TransactionAlreadySuccessfulException.code,
    })
  }
}
