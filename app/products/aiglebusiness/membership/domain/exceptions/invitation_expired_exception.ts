import { Exception } from '@adonisjs/core/exceptions'

export default class InvitationExpiredException extends Exception {
  static status = 410
  static code = 'E_INVITATION_EXPIRED'

  constructor(message: string = "L'invitation a expiré, demandez-en une nouvelle") {
    super(message, {
      status: InvitationExpiredException.status,
      code: InvitationExpiredException.code,
    })
  }
}
