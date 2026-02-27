import { Exception } from '@adonisjs/core/exceptions'

export default class ExpiredOtpException extends Exception {
  static status = 400
  static code = 'OTP_EXPIRED'

  constructor(message: string = 'Code OTP a expiré') {
    super(message, {
      status: ExpiredOtpException.status,
      code: ExpiredOtpException.code,
    })
  }
}
