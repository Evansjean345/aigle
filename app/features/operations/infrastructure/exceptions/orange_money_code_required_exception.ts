import { Exception } from '@adonisjs/core/exceptions'

export default class OrangeMoneyCodeRequiredException extends Exception {
  static status = 400
  static code = 'ORANGE_MONEY_CODE_REQUIRED'

  constructor(message: string = 'Le code temporaire orange money est requis') {
    super(message, {
      status: OrangeMoneyCodeRequiredException.status,
      code: OrangeMoneyCodeRequiredException.code,
    })
  }
}
