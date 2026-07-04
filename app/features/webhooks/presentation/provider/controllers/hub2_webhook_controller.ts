import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SettleProviderWebhookUseCase from '#features/webhooks/application/use_cases/settle_provider_webhook.use_case'
import { Hub2WebhookNormalizer } from '#features/webhooks/application/normalizers/hub2_webhook_normalizer'

/**
 * Réception directe des webhooks Hub2 (Lot 3b). La signature est vérifiée en amont par le
 * middleware `verify_hub2_signature`. Ici : normalisation → règlement via l'engine.
 *
 * Toujours répondre 200 (Hub2 retente sinon) même sur type non supporté / données invalides : on
 * acquitte la réception, on ne rejoue pas côté provider. Les échecs de traitement sont logués.
 */
@inject()
export default class Hub2WebhookController {
  constructor(private readonly settler: SettleProviderWebhookUseCase) {}

  async handle({ request, response, logger }: HttpContext): Promise<void> {
    const type = request.input('type')
    const data = request.input('data')

    if (!Hub2WebhookNormalizer.isSupported(type)) {
      logger.error({ type, service: 'hub2' }, 'Unsupported Hub2 webhook event type')
      return response.ok({})
    }

    const event = Hub2WebhookNormalizer.normalize(type, data)

    if (!event) {
      logger.error({ type, service: 'hub2' }, 'Invalid Hub2 webhook data')
      return response.ok({})
    }

    try {
      await this.settler.handle(event)
    } catch (error) {
      logger.error(
        { error: (error as Error).message, type, service: 'hub2' },
        'Hub2 webhook processing failed'
      )
    }
    return response.ok({})
  }
}
