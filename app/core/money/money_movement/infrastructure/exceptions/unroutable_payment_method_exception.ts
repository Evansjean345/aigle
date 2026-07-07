import { Exception } from '@adonisjs/core/exceptions'

/**
 * Levée quand un moyen de paiement non routable atteint la stratégie d'initiation externe
 * (ni `mobile-money` ni `credit-card`). Garde stricte : plutôt qu'un repli silencieux, on refuse
 * explicitement un moyen de paiement inattendu (ex. `wallet`, faute de frappe, config erronée).
 */
export default class UnroutablePaymentMethodException extends Exception {
  static status = 422
  static code = 'E_UNROUTABLE_PAYMENT_METHOD'

  constructor(paymentMethod: string) {
    super(`Moyen de paiement non routable : ${paymentMethod}`, {
      status: UnroutablePaymentMethodException.status,
      code: UnroutablePaymentMethodException.code,
    })
  }
}
