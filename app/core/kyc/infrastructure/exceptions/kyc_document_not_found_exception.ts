import { Exception } from '@adonisjs/core/exceptions'

export default class KycDocumentNotFoundException extends Exception {
  static status = 404
  static code = 'E_KYC_DOCUMENT_NOT_FOUND'

  constructor(message: string = 'Document KYC non trouvé.') {
    super(message, {
      status: KycDocumentNotFoundException.status,
      code: KycDocumentNotFoundException.code,
    })
  }
}
