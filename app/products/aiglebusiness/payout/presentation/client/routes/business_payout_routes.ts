import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

const BusinessPayoutController = () =>
  import('#aiglebusiness/payout/presentation/client/controllers/business_payout_controller')

/**
 * Transfert unique d'une organisation (canal client), scopé `organisations/:organisationId`.
 * Autorisation **déclarative** : permission `payout:initiate` (sensitive, bypass OWNER, vérif live
 * via `orgPermission`). L'**éligibilité KYB** (entreprise niveau 2) est appliquée dans le use case.
 */
export default function businessPayoutRoutes() {
  router
    .group(() => {
      router.post('organisations/:organisationId/transfers', [BusinessPayoutController, 'create'])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.payoutInitiate }),
    ])
}
