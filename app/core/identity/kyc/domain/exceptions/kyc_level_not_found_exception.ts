import { Exception } from '@adonisjs/core/exceptions'

export default class KycLevelNotFoundException extends Exception {
  static status = 404
  static code = 'E_KYC_LEVEL_NOT_FOUND'

  constructor(message: string = 'Niveau KYC non trouvé.') {
    super(message, {
      status: KycLevelNotFoundException.status,
      code: KycLevelNotFoundException.code,
    })
  }
}
