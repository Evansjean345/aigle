const LedgersController = () =>
  import('#core/money/ledger/presentation/admin/controllers/ledgers_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { LEDGER_PERMISSIONS } from '#core/money/ledger/presentation/admin/permissions.config'

const adminLedgerRoutes = () => {
  router
    .group(() => {
      router
        .get('/', [LedgersController, 'getAllLedgers'])
        .use(middleware.permission([LEDGER_PERMISSIONS.list]))

      router
        .get('/stats', [LedgersController, 'getLedgersStats'])
        .use(middleware.permission([LEDGER_PERMISSIONS.export]))
    })
    .prefix('/ledgers')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
}

export default adminLedgerRoutes
