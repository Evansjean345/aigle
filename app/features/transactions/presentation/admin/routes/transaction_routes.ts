import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminTransactionController = () =>
  import('#features/transactions/presentation/admin/controllers/transactions_controller')

export default function adminTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminTransactionController, 'getAllTransactions'])
      router.get('/stats', [AdminTransactionController, 'getTransactionsStats'])
      router.get('/:reference', [AdminTransactionController, 'findTransaction'])
    })
    .prefix('transactions')
    .use(middleware.auth({ guards: ['admin'] }))
}
