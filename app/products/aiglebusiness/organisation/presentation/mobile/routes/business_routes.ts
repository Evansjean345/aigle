import router from '@adonisjs/core/services/router'

const BusinessHealthController = () =>
  import('#aiglebusiness/organisation/presentation/mobile/controllers/business_health_controller')

/**
 * Routes mobiles du module produit business (aiglebusiness).
 *
 * Socle (sous-lot 0) : uniquement la route de liveness du module. Les routes
 * métier (organisation, membres, KYB, mass-payout…) sont ajoutées par sous-lot.
 * Préfixe produit : `business/` (sous le `/api` global monté dans start/routes).
 */
export default function mobileBusinessRoutes() {
  router
    .group(() => {
      router.get('health', [BusinessHealthController, 'handle'])
    })
    .prefix('business')
}
