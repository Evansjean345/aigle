import { Exception } from '@adonisjs/core/exceptions'

export default class KycAlreadySubmittedException extends Exception {
  static status = 400
  static code = 'E_ALREADY_SUBMITTED_KYC_DOCUMENTS'

  constructor(message: string = 'Vous avez déjà soumis vos documents KYC.') {
    super(message, {
      status: KycAlreadySubmittedException.status,
      code: KycAlreadySubmittedException.code,
    })
  }
}
