import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminWalletController = () =>
  import('#core/wallet/presentation/admin/controllers/admin_wallet_controller')
const AdminWalletAdjustmentController = () =>
  import('#core/wallet/presentation/admin/controllers/admin_wallet_adjustment_controller')

export default function adminWalletRoutes() {
  return router
    .group(() => {
      router.put('/:userId/activate', [AdminWalletController, 'activate'])
      router.put('/:userId/deactivate', [AdminWalletController, 'deactivate'])
      router.get('/adjustments', [AdminWalletAdjustmentController, 'list'])
      router.post('/adjustments', [AdminWalletAdjustmentController, 'execute'])
    })
    .prefix('wallets')
    .use(middleware.auth({ guards: ['admin'] }))
}
