import { Exception } from '@adonisjs/core/exceptions'

/**
 * Compte de collecte introuvable.
 *
 * Un compte désactivé existe toujours : il n'est pas concerné par cette exception.
 */
export default class CollectionAccountNotFoundException extends Exception {
  static status = 404
  static code = 'E_COLLECTION_ACCOUNT_NOT_FOUND'

  constructor() {
    super('Compte de collecte introuvable.', {
      status: 404,
      code: 'E_COLLECTION_ACCOUNT_NOT_FOUND',
    })
  }
}
