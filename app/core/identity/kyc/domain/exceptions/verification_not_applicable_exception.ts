import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un dossier a été soumis pour un compte dont le profil n'attend aucune pièce.
 */
export default class VerificationNotApplicableException extends Exception {
  static status = 400
  static code = 'E_VERIFICATION_NOT_APPLICABLE'

  constructor(message: string = "Ce compte ne fait pas l'objet d'une vérification.") {
    super(message, {
      status: VerificationNotApplicableException.status,
      code: VerificationNotApplicableException.code,
    })
  }
}
