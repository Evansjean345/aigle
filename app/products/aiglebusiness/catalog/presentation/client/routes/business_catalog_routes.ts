import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const BusinessCatalogController = () =>
  import('#aiglebusiness/catalog/presentation/client/controllers/business_catalog_controller')

/**
 * Catalogue (canal client business). Miroir des routes catalogue aiglesend
 * (`/mobile/services/payment-options`), exposées ici sous le préfixe `business`
 * et la chaîne de middleware business authentifiée (le flux de transfert est
 * post-login/appareil de confiance). Pas de permission d'org : lecture de catalogue.
 */
export default function businessCatalogRoutes() {
  router
    .group(() => {
      router.get('services/payment-options/:serviceType', [
        BusinessCatalogController,
        'paymentOptionsByServiceType',
      ])
      router.get('services/payment-options/:serviceType/to', [
        BusinessCatalogController,
        'paymentOptionsByServiceTypeTo',
      ])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
    ])
}
