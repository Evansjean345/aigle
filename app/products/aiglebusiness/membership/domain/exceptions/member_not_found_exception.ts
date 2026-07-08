import { Exception } from '@adonisjs/core/exceptions'

export default class MemberNotFoundException extends Exception {
  static status = 404
  static code = 'E_MEMBER_NOT_FOUND'

  constructor(message: string = 'Membre introuvable dans cette organisation') {
    super(message, {
      status: MemberNotFoundException.status,
      code: MemberNotFoundException.code,
    })
  }
}
