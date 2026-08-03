import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le crédit du wallet n'a pas pu être appliqué lors de la validation.
 *
 * Levée à l'intérieur de la transaction : tout est annulé et la demande reste en attente.
 */
export default class FundingCreditFailedException extends Exception {
  static status = 422
  static code = 'E_FUNDING_CREDIT_FAILED'

  constructor() {
    super("Le crédit du wallet n'a pas pu être appliqué. La demande reste en attente.", {
      status: 422,
      code: 'E_FUNDING_CREDIT_FAILED',
    })
  }
}
