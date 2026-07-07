import { Exception } from '@adonisjs/core/exceptions'

export default class SingleLimitExceededException extends Exception {
  static status = 403
  static code = 'SINGLE_LIMIT_EXCEEDED'

  constructor(limit: number, isIncoming: boolean = false) {
    const message = isIncoming
      ? 'Ce transfert ne peut pas être effectué pour le moment'
      : `Le montant dépasse la limite par transaction de ${limit} FCFA`
    super(message, {
      status: SingleLimitExceededException.status,
      code: SingleLimitExceededException.code,
    })
  }
}
