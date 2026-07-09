import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CheckoutController = () =>
  import('#core/money/checkout/presentation/public/controllers/checkout_controller')

/**
 * Routes PUBLIQUES de paiement marchand (checkout), consommées par la page aigleplay.
 * Aucune authentification (le payeur n'est pas forcément un utilisateur Aigle). URL neutre
 * `checkout/:code` (le code désigne un compte payable — rien n'indique « marchand »).
 * `geoip` pour l'IP/audit ; anti-abus (throttle) à ajouter (route publique).
 */
export default function checkoutRoutes() {
  router.get('checkout/payment-options', [CheckoutController, 'options'])
  router.post('checkout/:code', [CheckoutController, 'initiate']).use(middleware.geoip())
  router.get('checkout/:reference/status', [CheckoutController, 'status'])
}
