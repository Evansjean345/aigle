import { Exception } from '@adonisjs/core/exceptions'

export default class PaymentAlreadySuccessfulException extends Exception {
  static status = 400
  static code = 'PAYMENT_ALREADY_SUCCESSFUL'

  constructor() {
    super('Payment already successful', {
      status: PaymentAlreadySuccessfulException.status,
      code: PaymentAlreadySuccessfulException.code,
    })
  }
}
