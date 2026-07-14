import router from '@adonisjs/core/services/router'
import { payableAliasResolveThrottle } from '#core/qr/presentation/public/throttles/payable_alias_throttles'

const PayableAliasController = () =>
  import('#core/qr/presentation/public/controllers/payable_alias_controller')

/**
 * Routes PUBLIQUES de résolution d'alias payable (QR marchand), consommées par la
 * page de paiement aigleplay. Aucune authentification : le payeur n'est pas
 * forcément un utilisateur Aigle. Throttle anti-énumération (clé IP).
 */
export default function payableAliasRoutes() {
  router
    .get('qr/merchant/:code', [PayableAliasController, 'resolve'])
    .use(payableAliasResolveThrottle)
}
