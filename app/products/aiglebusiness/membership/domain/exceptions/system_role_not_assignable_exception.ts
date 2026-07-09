import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un rôle système (ex. OWNER) ne peut pas être attribué à la main via l'invitation
 * ou le changement de rôle. La propriété d'une organisation est unique et ne change
 * que par un transfert explicite. Empêche l'escalade de privilèges (création d'un
 * second propriétaire).
 */
export default class SystemRoleNotAssignableException extends Exception {
  static status = 403
  static code = 'E_SYSTEM_ROLE_NOT_ASSIGNABLE'

  constructor(
    message: string = 'Ce rôle ne peut pas être attribué. La propriété de l’organisation est unique et se transmet uniquement par un transfert explicite.'
  ) {
    super(message, {
      status: SystemRoleNotAssignableException.status,
      code: SystemRoleNotAssignableException.code,
    })
  }
}
