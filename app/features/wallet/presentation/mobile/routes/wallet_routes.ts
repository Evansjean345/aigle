import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const WalletOverViewController = () =>
  import('#mobile/wallet/controllers/wallet_overview_controller')

const WalletScanController = () => import('#mobile/wallet/controllers/wallet_scan_controller')

export default function mobileWalletRoutes() {
  return router
    .group(() => {
      router.get('overview', [WalletOverViewController, 'handle'])
      router.post('qr/resolve', [WalletScanController, 'handle'])
    })
    .prefix('mobile/wallet')
    .use(middleware.auth())
}
