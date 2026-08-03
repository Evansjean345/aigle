import { Exception } from '@adonisjs/core/exceptions'

/**
 * Une décision a été soumise sans commentaire.
 *
 * Le commentaire vaut attestation : le gestionnaire y consigne ce qu'il a vérifié. Une chaîne
 * d'espaces est traitée comme vide.
 */
export default class InvalidReviewCommentException extends Exception {
  static status = 422
  static code = 'E_INVALID_REVIEW_COMMENT'

  constructor() {
    super('Un commentaire est obligatoire : il atteste de votre vérification.', {
      status: 422,
      code: 'E_INVALID_REVIEW_COMMENT',
    })
  }
}
