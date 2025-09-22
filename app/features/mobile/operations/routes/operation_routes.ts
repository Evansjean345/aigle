import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DepositController = () => import('#mobile/operations/controllers/deposit_controller')
const TransfertController = () => import('#mobile/operations/controllers/transfert_controller')
const TransfertInterController = () =>
  import('#mobile/operations/controllers/transfert_inter_controller')

const mobileOperationRoutes = () =>
  router
    .group(() => {
      router.post('deposit', [DepositController])
      router.post('transfert', [TransfertController])
      router.post('transfert-inter', [TransfertInterController])
    })
    .prefix('mobile/operations')
    .use(middleware.auth())

export default mobileOperationRoutes
