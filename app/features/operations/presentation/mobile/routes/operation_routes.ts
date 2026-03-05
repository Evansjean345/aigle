import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DepositController = () =>
  import('#features/operations/presentation/mobile/controllers/deposit_controller')
const TransfertController = () =>
  import('#features/operations/presentation/mobile/controllers/transfert_controller')
const TransfertInterController = () =>
  import('#features/operations/presentation/mobile/controllers/transfert_inter_controller')
const WalletToWalletController = () =>
  import('#features/operations/presentation/mobile/controllers/wallet_to_wallet_controller')

const mobileOperationRoutes = () =>
  router
    .group(() => {
      router.post('deposit', [DepositController])
      router.post('transfert', [TransfertController])
      router.post('transfert-inter', [TransfertInterController])
      router.post('wallet-to-wallet', [WalletToWalletController])
    })
    .prefix('mobile/operations')
    .use([middleware.auth(), middleware.device(), middleware.geoip(), middleware.idempotency()])

export default mobileOperationRoutes
