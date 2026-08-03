import { Exception } from '@adonisjs/core/exceptions'

/**
 * La demande n'est plus en attente et ne peut plus être validée ni refusée.
 *
 * Levée après une lecture verrouillée, ce qui empêche deux gestionnaires de créditer la même
 * demande simultanément.
 */
export default class FundingRequestNotReviewableException extends Exception {
  static status = 409
  static code = 'E_FUNDING_REQUEST_NOT_REVIEWABLE'

  constructor() {
    super("Cette demande n'est plus en attente : elle a déjà été traitée.", {
      status: 409,
      code: 'E_FUNDING_REQUEST_NOT_REVIEWABLE',
    })
  }
}
