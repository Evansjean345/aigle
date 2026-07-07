import { Exception } from '@adonisjs/core/exceptions'

export default class OtpCreationException extends Exception {
  static status = 500
  static code = 'OTP_CREATION_ERROR'

  constructor(message: string = "Erreur lors de l'enregistrement de l'OTP") {
    super(message, {
      status: OtpCreationException.status,
      code: OtpCreationException.code,
    })
  }
}
