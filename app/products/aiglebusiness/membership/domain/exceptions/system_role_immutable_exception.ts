import { Exception } from '@adonisjs/core/exceptions'

export default class SystemRoleImmutableException extends Exception {
  static status = 403
  static code = 'E_SYSTEM_ROLE_IMMUTABLE'

  constructor(message: string = 'Le rôle système ne peut pas être modifié ou supprimé') {
    super(message, {
      status: SystemRoleImmutableException.status,
      code: SystemRoleImmutableException.code,
    })
  }
}
