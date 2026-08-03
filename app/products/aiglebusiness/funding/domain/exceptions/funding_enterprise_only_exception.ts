import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le réapprovisionnement est réservé aux organisations de type entreprise.
 */
export default class FundingEnterpriseOnlyException extends Exception {
  static status = 403
  static code = 'E_FUNDING_ENTERPRISE_ONLY'

  constructor() {
    super('Le réapprovisionnement est réservé aux comptes entreprise.', {
      status: 403,
      code: 'E_FUNDING_ENTERPRISE_ONLY',
    })
  }
}
