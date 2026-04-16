import { Exception } from '@adonisjs/core/exceptions'

export default class RefundFailedException extends Exception {
  constructor(message: string = 'Le remboursement a échoué') {
    super(message, { status: 500, code: 'E_REFUND_FAILED' })
  }
}
