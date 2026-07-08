import { Exception } from '@adonisjs/core/exceptions'

export default class RoleNotFoundException extends Exception {
  static status = 404
  static code = 'E_ROLE_NOT_FOUND'

  constructor(message: string = 'Rôle introuvable') {
    super(message, { status: RoleNotFoundException.status, code: RoleNotFoundException.code })
  }
}
