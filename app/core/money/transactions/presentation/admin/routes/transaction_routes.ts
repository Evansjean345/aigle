import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  TRANSACTION_PERMISSIONS,
  REFUND_PERMISSIONS,
} from '#core/money/transactions/presentation/admin/permissions.config'

const AdminTransactionController = () =>
  import('#core/money/transactions/presentation/admin/controllers/transactions_controller')

const AdminRefundController = () =>
  import('#core/money/transactions/presentation/admin/controllers/admin_refund_controller')

export default function adminTransactionRoutes() {
  return router
    .group(() => {
      router
        .get('/', [AdminTransactionController, 'getAllTransactions'])
        .use(middleware.permission([TRANSACTION_PERMISSIONS.list]))

      router
        .get('/stats', [AdminTransactionController, 'getTransactionsStats'])
        .use(middleware.permission([TRANSACTION_PERMISSIONS.export]))

      router
        .get('/refunds', [AdminRefundController, 'list'])
        .use(middleware.permission([REFUND_PERMISSIONS.list]))

      router
        .post('/refunds', [AdminRefundController, 'execute'])
        .use(middleware.permission([REFUND_PERMISSIONS.execute]))

      router
        .get('/:reference', [AdminTransactionController, 'findTransaction'])
        .use(middleware.permission([TRANSACTION_PERMISSIONS.read]))
    })
    .prefix('transactions')
    .use(middleware.auth({ guards: ['admin'] }))
}
