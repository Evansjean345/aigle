import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le paiement en masse est réservé aux organisations de type entreprise.
 *
 * Un compte marchand conserve le transfert unique.
 */
export default class MassTransferEnterpriseOnlyException extends Exception {
  static status = 403
  static code = 'E_MASS_TRANSFER_ENTERPRISE_ONLY'

  constructor() {
    super('Le paiement en masse est réservé aux comptes entreprise.', {
      status: 403,
      code: 'E_MASS_TRANSFER_ENTERPRISE_ONLY',
    })
  }
}
