import { Exception } from '@adonisjs/core/exceptions'

export default class UserAccountStatusUpdateException extends Exception {
  static status = 500
  static code = 'FAILED_TO_UPDATE_USER_ACCOUNT_STATUS'

  constructor(message: string = 'Failed to update user account status') {
    super(message, {
      status: UserAccountStatusUpdateException.status,
      code: UserAccountStatusUpdateException.code,
    })
  }
}
