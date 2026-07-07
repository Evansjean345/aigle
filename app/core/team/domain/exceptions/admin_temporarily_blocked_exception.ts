import { Exception } from '@adonisjs/core/exceptions'

export default class AdminTemporarilyBlockedException extends Exception {
  static status = 429
  static code = 'ADMIN_TEMPORARILY_BLOCKED'

  public readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60)
    super(`Compte temporairement verrouillé. Réessayez dans ${minutes} minute(s).`, {
      status: AdminTemporarilyBlockedException.status,
      code: AdminTemporarilyBlockedException.code,
    })
    this.retryAfterSeconds = retryAfterSeconds
  }
}
