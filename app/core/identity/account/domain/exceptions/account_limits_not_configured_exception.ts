import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand la grille de limites `(segment, level)` d'un compte est absente du catalogue
 * `kyc_level` — mauvaise configuration (un niveau sans limites définies ne peut pas être validé).
 */
export default class AccountLimitsNotConfiguredException extends Exception {
  static status = 500
  static code = 'E_ACCOUNT_LIMITS_NOT_CONFIGURED'

  constructor(
    message: string = 'Les limites de ce compte ne sont pas configurées. Veuillez réessayer plus tard.'
  ) {
    super(message, {
      status: AccountLimitsNotConfiguredException.status,
      code: AccountLimitsNotConfiguredException.code,
    })
  }
}
