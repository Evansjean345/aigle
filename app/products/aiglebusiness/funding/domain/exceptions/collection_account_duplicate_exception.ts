import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un compte de collecte portant ce numéro existe déjà.
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
