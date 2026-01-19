const LedgersController = () =>
  import('#features/ledger/presentation/admin/controllers/ledgers_controller')
import router from '@adonisjs/core/services/router'

const adminLedgerRoutes = () => {
  router
    .group(() => {
      router.get('/', [LedgersController, 'index'])
      router.get('/stats', [LedgersController, 'stats'])
      router.get('/chart', [LedgersController, 'chart'])
    })
    .prefix('/ledgers')
}

export default adminLedgerRoutes
