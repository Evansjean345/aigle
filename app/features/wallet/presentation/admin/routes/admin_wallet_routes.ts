import router from '@adonisjs/core/services/router'

const AdminWalletController = () =>
  import('#features/wallet/presentation/admin/controllers/admin_wallet_controller')

export default function adminWalletRoutes() {
  return router
    .group(() => {
      router.put('/:userId/activate', [AdminWalletController, 'activate'])
      router.put('/:userId/deactivate', [AdminWalletController, 'deactivate'])
    })
    .prefix('wallets')
}
