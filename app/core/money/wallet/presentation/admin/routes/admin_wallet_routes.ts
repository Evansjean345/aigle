import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  USER_WALLET_PERMISSIONS,
  WALLET_ADJUSTMENT_PERMISSIONS,
} from '#core/money/wallet/presentation/admin/permissions.config'

const AdminWalletController = () =>
  import('#core/money/wallet/presentation/admin/controllers/admin_wallet_controller')
const AdminWalletAdjustmentController = () =>
  import('#core/money/wallet/presentation/admin/controllers/admin_wallet_adjustment_controller')

export default function adminWalletRoutes() {
  return router
    .group(() => {
      // Le sens est dans l'URL, non dans le corps : chaque route porte ainsi son propre droit.
      router
        .patch('/:userId/freeze', [AdminWalletController, 'freeze'])
        .use(middleware.permission([USER_WALLET_PERMISSIONS.freeze]))
      router
        .patch('/:userId/unfreeze', [AdminWalletController, 'unfreeze'])
        .use(middleware.permission([USER_WALLET_PERMISSIONS.unfreeze]))
      router
        .get('/adjustments', [AdminWalletAdjustmentController, 'list'])
        .use(middleware.permission([WALLET_ADJUSTMENT_PERMISSIONS.list]))
      router
        .post('/adjustments', [AdminWalletAdjustmentController, 'execute'])
        .use(middleware.permission([WALLET_ADJUSTMENT_PERMISSIONS.execute]))
    })
    .prefix('wallets')
    .use(middleware.auth({ guards: ['admin'] }))
}
