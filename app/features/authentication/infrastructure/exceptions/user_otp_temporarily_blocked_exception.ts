import { Exception } from '@adonisjs/core/exceptions'

export default class UserOtpTemporarilyBlockedException extends Exception {
  static status = 429
  static code = 'USER_OTP_TEMPORARILY_BLOCKED'

  public readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60)

    super(
      `Pour des raisons de sécurité votre compte est temporairement verouillé. Veuillez réessayer dans ${minutes} minute(s).`,
      {
        status: UserOtpTemporarilyBlockedException.status,
        code: UserOtpTemporarilyBlockedException.code,
      }
    )
    this.retryAfterSeconds = retryAfterSeconds
  }
}
