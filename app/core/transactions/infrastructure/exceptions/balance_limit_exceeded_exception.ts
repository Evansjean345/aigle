import { Exception } from '@adonisjs/core/exceptions'

export default class BalanceLimitExceededException extends Exception {
  static status = 403
  static code = 'BALANCE_LIMIT_EXCEEDED'

  constructor(limit: number, isIncoming: boolean = false) {
    const message = isIncoming
      ? 'Ce transfert ne peut pas être effectué pour le moment'
      : `Le solde après cette opération dépassera la limite de ${limit} FCFA`
    super(message, {
      status: BalanceLimitExceededException.status,
      code: BalanceLimitExceededException.code,
    })
  }
}
