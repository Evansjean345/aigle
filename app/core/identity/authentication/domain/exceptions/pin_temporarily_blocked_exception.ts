import { Exception } from '@adonisjs/core/exceptions'

export default class PinTemporarilyBlockedException extends Exception {
  static status = 429
  static code = 'PIN_TEMPORARILY_BLOCKED'

  public readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60)

    super(
      `Pour des raisons de sécurité votre compte est temporairement vérrouillé. Réessayez dans ${minutes} minute(s).`,
      {
        status: PinTemporarilyBlockedException.status,
        code: PinTemporarilyBlockedException.code,
      }
    )
    this.retryAfterSeconds = retryAfterSeconds
  }
}
