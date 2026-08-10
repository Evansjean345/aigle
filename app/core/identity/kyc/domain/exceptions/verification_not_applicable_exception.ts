import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un dossier a été soumis pour un compte qui ne passe aucune vérification.
 *
 * C'est le cas d'un compte marchand : il encaisse dès sa création et n'a pas de KYB. Accepter le
 * dépôt laisserait un dossier que personne ne revoit jamais.
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
