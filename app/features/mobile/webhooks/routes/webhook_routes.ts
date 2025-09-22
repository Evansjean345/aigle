import router from '@adonisjs/core/services/router'

const DepositWebhookController = () => import('#mobile/webhooks/controllers/deposit_webhook_controller')
const TransferWebhookController = () => import('#mobile/webhooks/controllers/transfer_webhook_controller')

const mobileWebhookRoutes = () =>
  router
    .group(() => {
      // Deposit webhooks
      router.post('deposit/success', [DepositWebhookController, 'depositSuccess'])
      router.post('deposit/failure', [DepositWebhookController, 'depositFailure'])

      // Transfer webhooks
      router.post('transfer/success', [TransferWebhookController, 'transferSuccess'])
      router.post('transfer/failure', [TransferWebhookController, 'transferFailure'])
    })
    .prefix('mobile/webhooks')

export default mobileWebhookRoutes
