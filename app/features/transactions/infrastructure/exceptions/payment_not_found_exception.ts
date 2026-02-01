import { Exception } from '@adonisjs/core/exceptions'

export default class PaymentNotFoundException extends Exception {
  static status = 404
  static code = 'PAYMENT_NOT_FOUND'

  constructor() {
    super('Payment not found', {
      status: PaymentNotFoundException.status,
      code: PaymentNotFoundException.code,
    })
  }
}
