import { Exception } from '@adonisjs/core/exceptions'

/**
 * L'identifiant ne correspond pas au **type** de compte annoncé (F1) — un IBAN saisi pour un canal
 * mobile money, ou l'inverse.
 *
 * Refusé strictement : l'identifiant étant **immuable après création** (R-D6), une erreur de saisie
 * ne se corrige pas — elle se désactive et se recrée. C'est le dernier contrôle automatique avant
 * qu'un marchand verse sur un numéro erroné.
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
