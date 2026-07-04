import { Exception } from '@adonisjs/core/exceptions'

export default class MissingKycDocumentsException extends Exception {
  static status = 400
  static code = 'E_MISSING_KYC_DOCUMENTS'

  constructor(message: string = 'Documents KYC manquants.') {
    super(message, {
      status: MissingKycDocumentsException.status,
      code: MissingKycDocumentsException.code,
    })
  }
}
