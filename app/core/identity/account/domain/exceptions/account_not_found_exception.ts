import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand aucun compte ne correspond à l'`accountId` demandé (résolution du standing, etc.).
 */
export default class AccountNotFoundException extends Exception {
  static status = 404
  static code = 'E_ACCOUNT_NOT_FOUND'

  constructor(message: string = "Ce compte est introuvable ou n'existe plus.") {
    super(message, {
      status: AccountNotFoundException.status,
      code: AccountNotFoundException.code,
    })
  }
}
