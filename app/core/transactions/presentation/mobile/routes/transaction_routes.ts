import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MobileTransactionsController = () =>
  import('#core/transactions/presentation/mobile/controllers/transactions_controller')

export default function mobileTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [MobileTransactionsController, 'list'])
      router.get('/quotas', [MobileTransactionsController, 'getTransactionQuota'])
      router.get('/:reference', [MobileTransactionsController, 'details'])
      router.get('/stream/:reference', [MobileTransactionsController, 'streamTransaction'])
    })
    .prefix('mobile/transactions')
    .use([middleware.auth(), middleware.device()])
}
