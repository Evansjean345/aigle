import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le compte de collecte visé par la déclaration est inexistant ou désactivé.
 *
 * Les deux causes partagent la même exception pour ne pas renseigner l'appelant sur le contenu du
 * catalogue au-delà des comptes actifs.
 */
export default class CollectionAccountUnavailableException extends Exception {
  static status = 422
  static code = 'E_COLLECTION_ACCOUNT_UNAVAILABLE'

  constructor() {
    super("Ce compte de collecte n'est pas disponible pour une déclaration.", {
      status: 422,
      code: 'E_COLLECTION_ACCOUNT_UNAVAILABLE',
    })
  }
}
