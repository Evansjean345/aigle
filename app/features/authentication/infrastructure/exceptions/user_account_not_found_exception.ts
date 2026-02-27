import { Exception } from '@adonisjs/core/exceptions'

export default class UserAccountNotFoundException extends Exception {
  static status = 400
  static code = 'USER_ACCOUNT_NOT_FOUND'

  constructor(message: string = 'User account not found for this number') {
    super(message, {
      status: UserAccountNotFoundException.status,
      code: UserAccountNotFoundException.code,
    })
  }
}
