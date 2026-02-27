import { Exception } from '@adonisjs/core/exceptions'

export default class PaymentNotFoundException extends Exception {
  static status = 404
  static code = 'PAYMENT_NOT_FOUND'

  constructor(message: string = 'Payment not found') {
    super(message, {
      status: PaymentNotFoundException.status,
      code: PaymentNotFoundException.code,
    })
  }
}
