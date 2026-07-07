import { Exception } from '@adonisjs/core/exceptions'

export default class AdminAccountBlockedException extends Exception {
  static status = 401
  static code = 'ADMIN_ACCOUNT_BLOCKED'

  constructor(
    message: string = 'Compte administrateur suspendu. Contactez un super administrateur.'
  ) {
    super(message, {
      status: AdminAccountBlockedException.status,
      code: AdminAccountBlockedException.code,
    })
  }
}
