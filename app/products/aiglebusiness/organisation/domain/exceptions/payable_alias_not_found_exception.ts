import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand une organisation n'a pas d'alias payable.
 *
 * Distincte d'un encaissement suspendu : l'organisation n'encaisse pas du tout, il n'y a donc rien
 * à ouvrir ni à fermer.
 */
export default class PayableAliasNotFoundException extends Exception {
  static status = 404
  static code = 'E_PAYABLE_ALIAS_NOT_FOUND'

  constructor(message: string = "Cette organisation n'a pas de QR d'encaissement") {
    super(message, {
      status: PayableAliasNotFoundException.status,
      code: PayableAliasNotFoundException.code,
    })
  }
}
