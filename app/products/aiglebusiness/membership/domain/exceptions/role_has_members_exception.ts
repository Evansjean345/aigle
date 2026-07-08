import { Exception } from '@adonisjs/core/exceptions'

export default class RoleHasMembersException extends Exception {
  static status = 409
  static code = 'E_ROLE_HAS_MEMBERS'

  constructor(message: string = 'Ce rôle est attribué à des membres ; réassignez-les d’abord') {
    super(message, {
      status: RoleHasMembersException.status,
      code: RoleHasMembersException.code,
    })
  }
}
