import { Exception } from '@adonisjs/core/exceptions'

/**
 * Les fonctions d'équipe (rôles, membres) ne s'appliquent pas à un compte **marchand** :
 * un marchand est mono-utilisateur (le propriétaire opère seul). Seules les organisations
 * de type **entreprise** gèrent des rôles et des membres.
 */
export default class MerchantNoTeamException extends Exception {
  static status = 403
  static code = 'E_MERCHANT_NO_TEAM'

  constructor(
    message: string = "Un compte marchand ne gère pas d'équipe : les rôles et les membres sont réservés aux entreprises."
  ) {
    super(message, {
      status: MerchantNoTeamException.status,
      code: MerchantNoTeamException.code,
    })
  }
}
