import { Exception } from '@adonisjs/core/exceptions'

export default class InvalidPincodeException extends Exception {
  static status = 400
  static code = 'INVALID_PINCODE'

  constructor(message: string = 'Le code pin renseigné est invalide') {
    super(message, {
      status: InvalidPincodeException.status,
      code: InvalidPincodeException.code,
    })
  }
}
