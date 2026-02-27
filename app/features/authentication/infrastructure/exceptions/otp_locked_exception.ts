import { Exception } from '@adonisjs/core/exceptions'

export default class OtpLockedException extends Exception {
  static status = 400
  static code = 'OTP_LOCKED'

  constructor(message: string = 'Vous êtes temporairement bloqué. Veuillez réessayer plus tard.') {
    super(message, {
      status: OtpLockedException.status,
      code: OtpLockedException.code,
    })
  }
}
