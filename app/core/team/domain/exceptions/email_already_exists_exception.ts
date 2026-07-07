import { Exception } from '@adonisjs/core/exceptions'

export default class EmailAlreadyExistsException extends Exception {
  static status = 400
  static code = 'E_EMAIL_ALREADY_EXISTS'

  constructor(message: string = 'Cette adresse email est déjà utilisée') {
    super(message, {
      status: EmailAlreadyExistsException.status,
      code: EmailAlreadyExistsException.code,
    })
  }
}
