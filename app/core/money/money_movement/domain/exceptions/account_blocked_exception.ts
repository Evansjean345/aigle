import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée par la validation money quand le **statut du compte** (party) n'est pas actif : le compte
 * est bloqué (blocage admin, brute-force auth propagé, etc.) et ne peut pas mouvementer d'argent.
 * Distincte du **gel argent** (`WalletInactiveException`, statut du wallet).
 */
export default class AccountBlockedException extends Exception {
  static status = 403
  static code = 'E_ACCOUNT_BLOCKED'

  constructor(
    message: string = "Ce compte est bloqué et ne peut pas effectuer d'opération. Veuillez contacter le support."
  ) {
    super(message, {
      status: AccountBlockedException.status,
      code: AccountBlockedException.code,
    })
  }
}
