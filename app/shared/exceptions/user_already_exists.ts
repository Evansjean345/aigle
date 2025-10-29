import { Exception } from '@adonisjs/core/exceptions'

export class UserAlreadyExists extends Exception {
  static status = 400
  static code = 'E_USER_ALREADY_EXISTS'
}
