import { Exception } from '@adonisjs/core/exceptions'

export default class PhoneNotFoundException extends Exception {
  static status = 400
  static code = 'PHONE_NOT_FOUND'

  constructor(message: string = "Ce numéro de téléphone n'existe pas") {
    super(message, {
      status: PhoneNotFoundException.status,
      code: PhoneNotFoundException.code,
    })
  }
}
