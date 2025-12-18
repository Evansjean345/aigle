import router from '@adonisjs/core/services/router'

const AdminTransactionController = () =>
  import('#features/transactions/presentation/admin/controllers/transactions_controller')

export default function adminTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminTransactionController, 'all'])
    })
    .prefix('transactions')
}
