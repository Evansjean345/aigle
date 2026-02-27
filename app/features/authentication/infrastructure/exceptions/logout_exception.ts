import { Exception } from '@adonisjs/core/exceptions'

export default class LogoutException extends Exception {
  static status = 500
  static code = 'LOGOUT_FAILED'

  constructor(message: string = 'Failed to logout') {
    super(message, {
      status: LogoutException.status,
      code: LogoutException.code,
    })
  }
}
