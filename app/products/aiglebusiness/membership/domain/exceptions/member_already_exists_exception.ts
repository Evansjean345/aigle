import { Exception } from '@adonisjs/core/exceptions'

export default class MemberAlreadyExistsException extends Exception {
  static status = 409
  static code = 'E_MEMBER_ALREADY_EXISTS'

  constructor(message: string = 'Cet utilisateur est déjà membre de cette organisation') {
    super(message, {
      status: MemberAlreadyExistsException.status,
      code: MemberAlreadyExistsException.code,
    })
  }
}
