const LedgersController = () =>
  import('#features/ledger/presentation/admin/controllers/ledgers_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const adminLedgerRoutes = () => {
  router
    .group(() => {
      router.get('/', [LedgersController, 'getAllLedgers'])
      router.get('/stats', [LedgersController, 'getLedgersStats'])
    })
    .prefix('/ledgers')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
}

export default adminLedgerRoutes
