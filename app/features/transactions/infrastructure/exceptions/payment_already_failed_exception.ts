import { Exception } from '@adonisjs/core/exceptions'

export default class PaymentAlreadyFailedException extends Exception {
  static status = 400
  static code = 'PAYMENT_ALREADY_FAILED'

  constructor() {
    super('Payment already failed', {
      status: PaymentAlreadyFailedException.status,
      code: PaymentAlreadyFailedException.code,
    })
  }
}
