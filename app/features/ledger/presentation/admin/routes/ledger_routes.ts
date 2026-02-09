const LedgersController = () =>
  import('#features/ledger/presentation/admin/controllers/ledgers_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const adminLedgerRoutes = () => {
  router
    .group(() => {
      router.get('/', [LedgersController, 'index'])
      router.get('/stats', [LedgersController, 'stats'])
      router.get('/chart', [LedgersController, 'chart'])
    })
    .prefix('/ledgers')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
    .use(
      middleware.permission(['finance.view'])
    )
}

export default adminLedgerRoutes
