import { Exception } from '@adonisjs/core/exceptions'

export default class UserAlreadyExistsException extends Exception {
  static status = 409
  static code = 'USER_ALREADY_EXISTS'

  constructor(message: string = 'Utilisateur existe déjà') {
    super(message, {
      status: UserAlreadyExistsException.status,
      code: UserAlreadyExistsException.code,
    })
  }
}
