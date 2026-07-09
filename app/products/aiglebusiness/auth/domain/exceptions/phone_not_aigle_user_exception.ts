import { Exception } from '@adonisjs/core/exceptions'

export default class PhoneNotAigleUserException extends Exception {
  static status = 404
  static code = 'E_NOT_AIGLE_USER'

  constructor(
    message: string = "Aucun compte Aiglesend pour ce numéro. Créez d'abord votre compte sur Aiglesend."
  ) {
    super(message, {
      status: PhoneNotAigleUserException.status,
      code: PhoneNotAigleUserException.code,
    })
  }
}
