import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

const BusinessTransactionsController = () =>
  import('#aiglebusiness/transactions/presentation/client/controllers/business_transactions_controller')

/**
 * Transactions d'une organisation (canal client), scopées `organisations/:organisationId`.
 * Autorisation **déclarative** : permission `transactions:view` (bypass OWNER, vérif live via
 * `orgPermission`). Le marchand voit ainsi la liste et le détail de ses encaissements.
 */
export default function businessTransactionsRoutes() {
  router
    .group(() => {
      router.get('organisations/:organisationId/transactions', [
        BusinessTransactionsController,
        'list',
      ])
      router.get('organisations/:organisationId/transactions/quotas', [
        BusinessTransactionsController,
        'quotas',
      ])
      router.get('organisations/:organisationId/transactions/summary', [
        BusinessTransactionsController,
        'summary',
      ])
      router.get('organisations/:organisationId/transactions/chart', [
        BusinessTransactionsController,
        'chart',
      ])
      // Après les segments fixes, sinon « summary » serait pris pour une référence.
      router.get('organisations/:organisationId/transactions/:reference', [
        BusinessTransactionsController,
        'details',
      ])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
      middleware.activeOrganisation(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transactionsView }),
    ])
}
