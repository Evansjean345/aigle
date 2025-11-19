import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MobileTransactionsController = () =>
  import('#mobile/transactions/controllers/transactions_controller')

export default function mobileTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [MobileTransactionsController, 'list'])
      router.get('/:reference', [MobileTransactionsController, 'details'])
    })
    .prefix('mobile/transactions')
    .use(middleware.auth())
}
