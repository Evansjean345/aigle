import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

const BusinessTransferController = () =>
  import('#aiglebusiness/transfer/presentation/client/controllers/business_transfer_controller')

/**
 * Transfert unique d'une organisation (canal client), scopé `organisations/:organisationId`.
 * Autorisation **déclarative** : permission `transfer:initiate` (sensitive, bypass OWNER, vérif live
 * via `orgPermission`). Le plafonnement (limites du compte) est appliqué dans le core.
 */
export default function businessTransferRoutes() {
  router
    .group(() => {
      router.post('organisations/:organisationId/transfers', [BusinessTransferController, 'create'])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transferInitiate }),
    ])
}