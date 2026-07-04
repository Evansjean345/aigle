import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminTransactionController = () =>
  import('#core/transactions/presentation/admin/controllers/transactions_controller')

const AdminRefundController = () =>
  import('#core/transactions/presentation/admin/controllers/admin_refund_controller')

export default function adminTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [AdminTransactionController, 'getAllTransactions'])
      router.get('/stats', [AdminTransactionController, 'getTransactionsStats'])
      router.get('/refunds', [AdminRefundController, 'list'])
      router.post('/refunds', [AdminRefundController, 'execute'])
      router.get('/:reference', [AdminTransactionController, 'findTransaction'])
    })
    .prefix('transactions')
    .use(middleware.auth({ guards: ['admin'] }))
}
