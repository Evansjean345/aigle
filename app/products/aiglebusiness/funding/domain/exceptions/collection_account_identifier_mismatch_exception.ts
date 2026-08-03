import { Exception } from '@adonisjs/core/exceptions'

/**
 * L'identifiant ne correspond pas au format attendu pour le type de compte annoncé.
 */
export default class CollectionAccountIdentifierMismatchException extends Exception {
  static status = 422
  static code = 'E_COLLECTION_ACCOUNT_IDENTIFIER_MISMATCH'

  constructor(type: string) {
    super(`L'identifiant ne correspond pas au format attendu pour un compte « ${type} ».`, {
      status: 422,
      code: 'E_COLLECTION_ACCOUNT_IDENTIFIER_MISMATCH',
    })
  }
}
