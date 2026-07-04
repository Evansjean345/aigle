import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidUserIdException extends Exception {
  static status = 400
  static code = 'INVALID_USER_ID'

  constructor() {
    super("L'identifiant de l'utilisateur n'est pas valide", {
      status: InvalidUserIdException.status,
      code: InvalidUserIdException.code,
    })
  }
}
