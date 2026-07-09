import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const WalletOverViewController = () =>
  import('#core/money/wallet/presentation/mobile/controllers/wallet_overview_controller')

export default function mobileWalletRoutes() {
  return router
    .group(() => {
      router.get('overview', [WalletOverViewController, 'handle'])
    })
    .prefix('mobile/wallet')
    .use([
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLESEND }),
      middleware.device(),
    ])
}
