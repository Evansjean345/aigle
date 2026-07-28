import { Exception } from '@adonisjs/core/exceptions'

/**
 * Compte de collecte introuvable (F1) — référence inconnue.
 *
 * Un canal **désactivé** existe toujours : il n'est pas « introuvable », il est seulement invisible
 * côté marchand. Cette exception ne concerne donc qu'une référence qui n'a jamais existé.
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
