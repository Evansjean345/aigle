import { Exception } from '@adonisjs/core/exceptions'

export default class KycLevelNotFoundException extends Exception {
  static status = 500
  static code = 'KYC_LEVEL_NOT_FOUND'

  constructor() {
    super('Niveau de KYC introuvable. Veuillez contacter le support', {
      status: KycLevelNotFoundException.status,
      code: KycLevelNotFoundException.code,
    })
  }
}
