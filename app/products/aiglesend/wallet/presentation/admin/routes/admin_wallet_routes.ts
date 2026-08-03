import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  USER_WALLET_PERMISSIONS,
  WALLET_ADJUSTMENT_PERMISSIONS,
} from '#aiglesend/wallet/presentation/admin/permissions.config'

const WalletController = () =>
  import('#aiglesend/wallet/presentation/admin/controllers/wallet_controller')
const WalletAdjustmentController = () =>
  import('#aiglesend/wallet/presentation/admin/controllers/wallet_adjustment_controller')

export default function adminWalletRoutes() {
  return router
    .group(() => {
      // Le sens est dans l'URL, non dans le corps : chaque route porte ainsi son propre droit.
      router
        .patch('/:userId/freeze', [WalletController, 'freeze'])
        .use(middleware.permission([USER_WALLET_PERMISSIONS.freeze]))
      router
        .patch('/:userId/unfreeze', [WalletController, 'unfreeze'])
        .use(middleware.permission([USER_WALLET_PERMISSIONS.unfreeze]))
      router
        .get('/adjustments', [WalletAdjustmentController, 'list'])
        .use(middleware.permission([WALLET_ADJUSTMENT_PERMISSIONS.list]))
      router
        .post('/adjustments', [WalletAdjustmentController, 'execute'])
        .use(middleware.permission([WALLET_ADJUSTMENT_PERMISSIONS.execute]))
    })
    .prefix('wallets')
    .use(middleware.auth({ guards: ['admin'] }))
}
