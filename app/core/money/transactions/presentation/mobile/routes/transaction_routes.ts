import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const MobileTransactionsController = () =>
  import('#core/money/transactions/presentation/mobile/controllers/transactions_controller')

export default function mobileTransactionRoutes() {
  return router
    .group(() => {
      router.get('/', [MobileTransactionsController, 'list'])
      router.get('/quotas', [MobileTransactionsController, 'getTransactionQuota'])
      router.get('/:reference', [MobileTransactionsController, 'details'])
      router.get('/stream/:reference', [MobileTransactionsController, 'streamTransaction'])
    })
    .prefix('mobile/transactions')
    .use([
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLESEND }),
      middleware.device(),
    ])
}
