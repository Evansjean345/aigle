import { Exception } from '@adonisjs/core/exceptions'

export default class AdminNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_NOT_FOUND'

  constructor(message: string = 'Administrateur non trouvé') {
    super(message, {
      status: AdminNotFoundException.status,
      code: AdminNotFoundException.code,
    })
  }
}
