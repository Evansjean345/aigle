import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SettleProviderWebhookUseCase from '#features/webhooks/application/use_cases/settle_provider_webhook.use_case'
import { WaveWebhookNormalizer } from '#features/webhooks/application/normalizers/wave_webhook_normalizer'

/**
 * Réception directe des webhooks Wave (Lot 3b). Normalisation → règlement via l'engine.
 *
 * Toujours répondre 200 (acquittement de réception) même sur type non supporté / données
 * invalides ; les échecs de traitement sont logués.
 */
@inject()
export default class WaveWebhookController {
  constructor(private readonly settler: SettleProviderWebhookUseCase) {}

  async handle({ request, response, logger }: HttpContext): Promise<void> {
    const type = request.input('type')
    const data = request.input('data')

    if (!WaveWebhookNormalizer.isSupported(type)) {
      logger.error({ type, service: 'wave' }, 'Unsupported Wave webhook event type')
      return response.ok({})
    }

    const event = WaveWebhookNormalizer.normalize(type, data)

    if (!event) {
      logger.error({ type, service: 'wave' }, 'Invalid Wave webhook data')
      return response.ok({})
    }

    try {
      await this.settler.handle(event)
    } catch (error) {
      logger.error(
        { error: (error as Error).message, type, service: 'wave' },
        'Wave webhook processing failed'
      )
    }
    return response.ok({})
  }
}
