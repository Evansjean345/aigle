import router from '@adonisjs/core/services/router'
import { webhookThrottle } from '#start/limiter'

const DepositWebhookController = () =>
  import('#features/webhooks/presentation/mobile/controllers/deposit_webhook_controller')
const TransferWebhookController = () =>
  import('#features/webhooks/presentation/mobile/controllers/transfer_webhook_controller')
const TransfertInterWebhookController = () =>
  import('#features/webhooks/presentation/mobile/controllers/transfert_inter_webhook_controller')

const mobileWebhookRoutes = () =>
  router
    .group(() => {
      // Deposit webhooks
      router.post('deposit/success', [DepositWebhookController, 'depositSuccess'])
      router.post('deposit/failure', [DepositWebhookController, 'depositFailure'])

      // Transfer webhooks
      router.post('transfer/success', [TransferWebhookController, 'transferSuccess'])
      router.post('transfer/failure', [TransferWebhookController, 'transferFailure'])

      // Inter-network transfer (transfert inter-réseau) webhooks
      router.post('transfer-inter/success', [TransfertInterWebhookController, 'interSuccess'])
      router.post('transfer-inter/failure', [TransfertInterWebhookController, 'interFailure'])
      router.post('transfer-inter/second/success', [
        TransfertInterWebhookController,
        'interSecondSuccess',
      ])
      router.post('transfer-inter/second/failure', [
        TransfertInterWebhookController,
        'interSecondFailure',
      ])
    })
    .prefix('mobile/webhooks')
    .use(webhookThrottle)

export default mobileWebhookRoutes
