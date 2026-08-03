import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le gestionnaire qui confirme est celui qui a donné la première approbation.
 *
 * Deux valideurs distincts sont exigés : sans cela, le second regard n'existe pas.
 */
export default class SecondApprovalSameAdminException extends Exception {
  static status = 403
  static code = 'E_SECOND_APPROVAL_SAME_ADMIN'

  constructor() {
    super('La confirmation doit être donnée par un gestionnaire différent du premier valideur.', {
      status: 403,
      code: 'E_SECOND_APPROVAL_SAME_ADMIN',
    })
  }
}
