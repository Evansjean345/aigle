import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand on tente de dégeler le portefeuille d'une organisation bloquée.
 *
 * Rendre l'argent avant l'accès remettrait les mouvements en marche alors que plus personne dans
 * l'organisation ne peut intervenir. Le déblocage vient d'abord.
 */
export default class UnfreezeOnBlockedOrganisationException extends Exception {
  static status = 409
  static code = 'E_UNFREEZE_ON_BLOCKED_ORGANISATION'

  constructor(
    message: string = "Débloquez l'organisation avant de dégeler son portefeuille."
  ) {
    super(message, {
      status: UnfreezeOnBlockedOrganisationException.status,
      code: UnfreezeOnBlockedOrganisationException.code,
    })
  }
}
