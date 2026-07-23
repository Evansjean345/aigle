import { Exception } from '@adonisjs/core/exceptions'

/**
 * Gate d'éligibilité du **paiement en masse** (L2-D23) : réservé aux comptes **ENTERPRISE**. Un
 * compte **marchand** est bloqué (il garde le transfert unique, L1-D6). Distinct de la sémantique
 * « équipe » (`E_MERCHANT_NO_TEAM`).
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
