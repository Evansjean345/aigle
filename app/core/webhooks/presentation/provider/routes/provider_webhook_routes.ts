import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const Hub2WebhookController = () =>
  import('#core/webhooks/presentation/provider/controllers/hub2_webhook_controller')
const WaveWebhookController = () =>
  import('#core/webhooks/presentation/provider/controllers/wave_webhook_controller')

export default function providerWebhookRoutes() {
  router
    .group(() => {
      router
        .post('hub2/payments/success', [Hub2WebhookController])
        .as('provider.hub2.payments.success')
        .use(middleware.verify_hub2_signature({ route: 'payments.success' }))
      router
        .post('hub2/payments/failed', [Hub2WebhookController])
        .as('provider.hub2.payments.failed')
        .use(middleware.verify_hub2_signature({ route: 'payments.failed' }))
      router
        .post('hub2/transfers/success', [Hub2WebhookController])
        .as('provider.hub2.transfers.success')
        .use(middleware.verify_hub2_signature({ route: 'transfers.success' }))
      router
        .post('hub2/transfers/failed', [Hub2WebhookController])
        .as('provider.hub2.transfers.failed')
        .use(middleware.verify_hub2_signature({ route: 'transfers.failed' }))

      router.post('wave', [WaveWebhookController]).as('provider.wave')
    })
    .prefix('provider-webhooks')
}
