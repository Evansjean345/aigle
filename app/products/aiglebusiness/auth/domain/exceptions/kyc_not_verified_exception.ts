import { Exception } from '@adonisjs/core/exceptions'

export default class KycNotVerifiedException extends Exception {
  static status = 403
  static code = 'E_KYC_NOT_VERIFIED'

  constructor(
    message: string = 'Votre vérification KYC doit être validée pour accéder à AigleBusiness.'
  ) {
    super(message, {
      status: KycNotVerifiedException.status,
      code: KycNotVerifiedException.code,
    })
  }
}
