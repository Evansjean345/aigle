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
      router.post('deposit', [DepositController]).use(middleware.idempotency())
      router.post('transfert', [TransfertController]).use(middleware.idempotency())
      router.post('transfert-inter', [TransfertInterController]).use(middleware.idempotency())
      router.post('wallet-to-wallet', [WalletToWalletController]).use(middleware.idempotency())
    })
    .prefix('mobile/operations')
    .use(middleware.auth())

export default mobileOperationRoutes
