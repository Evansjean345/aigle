import { Exception } from '@adonisjs/core/exceptions'

export default class InviteeKycNotVerifiedException extends Exception {
  static status = 403
  static code = 'E_INVITEE_KYC_NOT_VERIFIED'

  constructor(
    message: string = "L'invité doit avoir un KYC vérifié pour rejoindre une organisation"
  ) {
    super(message, {
      status: InviteeKycNotVerifiedException.status,
      code: InviteeKycNotVerifiedException.code,
    })
  }
}
