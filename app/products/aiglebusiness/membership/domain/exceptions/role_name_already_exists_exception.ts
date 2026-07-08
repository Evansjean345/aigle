import { Exception } from '@adonisjs/core/exceptions'

export default class RoleNameAlreadyExistsException extends Exception {
  static status = 409
  static code = 'E_ROLE_NAME_ALREADY_EXISTS'

  constructor(message: string = 'Un rôle portant ce nom existe déjà') {
    super(message, {
      status: RoleNameAlreadyExistsException.status,
      code: RoleNameAlreadyExistsException.code,
    })
  }
}
