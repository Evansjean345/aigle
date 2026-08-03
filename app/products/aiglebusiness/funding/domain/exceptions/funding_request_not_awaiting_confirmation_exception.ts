import { Exception } from '@adonisjs/core/exceptions'

/**
 * Une confirmation a été demandée sur une demande qui n'attend pas de second valideur.
 *
 * Soit elle n'a pas encore reçu de première approbation, soit elle est déjà close.
 */
export default class FundingRequestNotAwaitingConfirmationException extends Exception {
  static status = 409
  static code = 'E_FUNDING_REQUEST_NOT_AWAITING_CONFIRMATION'

  constructor() {
    super("Cette demande n'attend pas de confirmation par un second gestionnaire.", {
      status: 409,
      code: 'E_FUNDING_REQUEST_NOT_AWAITING_CONFIRMATION',
    })
  }
}
