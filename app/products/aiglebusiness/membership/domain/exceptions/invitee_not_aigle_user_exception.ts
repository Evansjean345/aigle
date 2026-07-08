import { Exception } from '@adonisjs/core/exceptions'

export default class InviteeNotAigleUserException extends Exception {
  static status = 404
  static code = 'E_INVITEE_NOT_AIGLE_USER'

  constructor(
    message: string = "L'invité doit posséder un compte AigleSend pour rejoindre une organisation"
  ) {
    super(message, {
      status: InviteeNotAigleUserException.status,
      code: InviteeNotAigleUserException.code,
    })
  }
}
