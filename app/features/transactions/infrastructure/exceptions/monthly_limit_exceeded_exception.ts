import { Exception } from '@adonisjs/core/exceptions'

export default class MonthlyLimitExceededException extends Exception {
  static status = 403
  static code = 'MONTHLY_LIMIT_EXCEEDED'

  constructor(limit: number, used: number, isIncoming: boolean = false) {
    const message = isIncoming
      ? 'Ce transfert ne peut pas être effectué pour le moment'
      : `Limite mensuelle dépassée. Limite: ${limit} FCFA, Utilisé: ${used} FCFA`
    super(message, {
      status: MonthlyLimitExceededException.status,
      code: MonthlyLimitExceededException.code,
    })
  }
}
