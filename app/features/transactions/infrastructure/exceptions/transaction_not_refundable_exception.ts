import { Exception } from '@adonisjs/core/exceptions'

export default class TransactionNotRefundableException extends Exception {
  constructor(message: string = 'Cette transaction ne peut pas etre remboursee') {
    super(message, { status: 422, code: 'E_TRANSACTION_NOT_REFUNDABLE' })
  }
}
