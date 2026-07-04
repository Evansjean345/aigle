import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand une opération du `MoneyMovementEngine` n'est pas encore branchée : une primitive
 * (ex. `reverse`) ou un `kind` de settlement pas encore couvert. Le comble se fait progressivement,
 * flux par flux (Lot 2/3) ; statut 501 en attendant.
 */
export default class MovementNotImplementedException extends Exception {
  static status = 501
  static code = 'E_NOT_IMPLEMENTED'

  constructor(operation: string) {
    super(`MoneyMovementEngine : ${operation} n'est pas encore implémenté`, {
      status: MovementNotImplementedException.status,
      code: MovementNotImplementedException.code,
    })
  }
}
