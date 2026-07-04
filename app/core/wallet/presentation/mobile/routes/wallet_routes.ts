import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const WalletOverViewController = () =>
  import('#core/wallet/presentation/mobile/controllers/wallet_overview_controller')

export default function mobileWalletRoutes() {
  return router
    .group(() => {
      router.get('overview', [WalletOverViewController, 'handle'])
    })
    .prefix('mobile/wallet')
    .use([middleware.auth(), middleware.device()])
}
