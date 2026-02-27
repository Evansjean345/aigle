import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidOtpException extends Exception {
  static status = 400
  static code = 'OTP_INVALID'

  constructor(message: string = 'Code Otp incorrect') {
    super(message, {
      status: InvalidOtpException.status,
      code: InvalidOtpException.code,
    })
  }
}
