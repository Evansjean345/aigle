import router from '@adonisjs/core/services/router'

const BusinessHealthController = () =>
  import('#aiglebusiness/organisation/presentation/client/controllers/business_health_controller')

/**
 * Routes du canal CLIENT du module produit business (aiglebusiness).
 *
 * Canal `client` = client self-service business (membres d'organisation), servi
 * indifféremment sur mobile ET web (même API REST) — d'où un canal nommé par
 * audience et non par facteur de forme (cf. mobile/admin/provider du core). Un
 * futur back-office business vivrait sous presentation/admin/.
 *
 * Socle (sous-lot 0) : uniquement la route de liveness du module. Les routes
 * métier (organisation, membres, KYB, mass-payout…) sont ajoutées par sous-lot.
 * Préfixe produit : `business/` (sous le `/api` global monté dans start/routes).
 */
export default function businessClientRoutes() {
  router
    .group(() => {
      router.get('health', [BusinessHealthController, 'handle'])
    })
    .prefix('business')
}
