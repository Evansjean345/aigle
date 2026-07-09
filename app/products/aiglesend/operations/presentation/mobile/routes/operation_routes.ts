import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const DepositController = () =>
  import('#aiglesend/operations/presentation/mobile/controllers/deposit_controller')
const TransfertController = () =>
  import('#aiglesend/operations/presentation/mobile/controllers/transfert_controller')
const TransfertInterController = () =>
  import('#aiglesend/operations/presentation/mobile/controllers/transfert_inter_controller')
const WalletToWalletController = () =>
  import('#aiglesend/operations/presentation/mobile/controllers/wallet_to_wallet_controller')

const mobileOperationRoutes = () =>
  router
    .group(() => {
      router.post('deposit', [DepositController])
      router.post('transfert', [TransfertController])
      router.post('transfert-inter', [TransfertInterController])
      router.post('wallet-to-wallet', [WalletToWalletController])
    })
    .prefix('mobile/operations')
    .use([
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLESEND }),
      middleware.device(),
      middleware.geoip(),
      middleware.idempotency(),
    ])

export default mobileOperationRoutes
