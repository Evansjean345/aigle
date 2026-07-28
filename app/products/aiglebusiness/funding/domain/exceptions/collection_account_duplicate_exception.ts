import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un compte de collecte portant ce numéro existe déjà (F1).
 *
 * Refusé parce que deux entrées identiques obligeraient le marchand à choisir au hasard entre elles
 * — et parce que l'identifiant étant **immuable** (R-D6), un doublon ne pourrait plus être corrigé,
 * seulement désactivé.
 */
export default class CollectionAccountDuplicateException extends Exception {
  static status = 422
  static code = 'E_COLLECTION_ACCOUNT_DUPLICATE'

  constructor() {
    super('Un compte de collecte avec cet identifiant existe déjà.', {
      status: 422,
      code: 'E_COLLECTION_ACCOUNT_DUPLICATE',
    })
  }
}
