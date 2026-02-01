import { Exception } from '@adonisjs/core/exceptions'

export default class ModeUnsupportedException extends Exception {
  static status = 400
  static code = 'MODE_UNSUPPORTED'

  constructor(message: string = 'Mode non supporté') {
    super(message, {
      status: ModeUnsupportedException.status,
      code: ModeUnsupportedException.code,
    })
  }
}
