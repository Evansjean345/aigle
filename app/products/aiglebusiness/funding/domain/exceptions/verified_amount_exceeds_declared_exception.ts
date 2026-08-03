import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le montant vérifié dépasse le montant déclaré par le marchand.
 *
 * Les écarts légitimes (frais bancaires, arrondis, versement partiel) vont à la baisse.
 */
export default class VerifiedAmountExceedsDeclaredException extends Exception {
  static status = 422
  static code = 'E_VERIFIED_AMOUNT_EXCEEDS_DECLARED'

  constructor(verifiedAmount: number, declaredAmount: number) {
    super(
      `Le montant vérifié (${verifiedAmount}) dépasse le montant déclaré (${declaredAmount}). ` +
        'Un versement ne peut pas être crédité au-delà de ce que le marchand déclare avoir versé.',
      { status: 422, code: 'E_VERIFIED_AMOUNT_EXCEEDS_DECLARED' }
    )
  }
}
