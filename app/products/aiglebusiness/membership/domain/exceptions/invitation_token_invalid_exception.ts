import { Exception } from '@adonisjs/core/exceptions'

export default class InvitationTokenInvalidException extends Exception {
  static status = 404
  static code = 'E_INVITATION_TOKEN_INVALID'

  constructor(message: string = 'Invitation introuvable ou invalide') {
    super(message, {
      status: InvitationTokenInvalidException.status,
      code: InvitationTokenInvalidException.code,
    })
  }
}
