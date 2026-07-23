import { Exception } from '@adonisjs/core/exceptions'

/**
 * Séparation des tâches (maker-checker, L2-D21) : l'initiateur d'un lot ne peut pas l'approuver
 * lui-même, **sauf** s'il est l'OWNER de l'organisation (org à une personne).
 */
export default class SelfApprovalNotAllowedException extends Exception {
  static status = 403
  static code = 'E_SELF_APPROVAL_NOT_ALLOWED'

  constructor() {
    super("L'initiateur ne peut pas approuver son propre lot (séparation des tâches).", {
      status: 403,
      code: 'E_SELF_APPROVAL_NOT_ALLOWED',
    })
  }
}
