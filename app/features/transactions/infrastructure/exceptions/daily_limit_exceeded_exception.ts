import { Exception } from '@adonisjs/core/exceptions'

export default class DailyLimitExceededException extends Exception {
  static status = 403
  static code = 'DAILY_LIMIT_EXCEEDED'

  constructor(limit: number, used: number, isIncoming: boolean = false) {
    const message = isIncoming
      ? 'Ce transfert ne peut pas être effectué pour le moment'
      : `Limite quotidienne dépassée. Limite: ${limit} FCFA, Utilisé: ${used} FCFA`
    super(message, {
      status: DailyLimitExceededException.status,
      code: DailyLimitExceededException.code,
    })
  }
}
