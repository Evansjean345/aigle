import { Exception } from '@adonisjs/core/exceptions'

export default class KycLevelAlreadyExistsException extends Exception {
  static status = 400
  static code = 'E_KYC_LEVEL_ALREADY_EXISTS'

  constructor(level: number) {
    super(`Le niveau KYC ${level} existe déjà.`, {
      status: KycLevelAlreadyExistsException.status,
      code: KycLevelAlreadyExistsException.code,
    })
  }
}
