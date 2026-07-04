import type { ProviderWebhookEvent } from '#features/webhooks/domain/value_objects/provider_webhook_event'

/**
 * Normalise les webhooks Wave en `ProviderWebhookEvent` (Lot 3b). Porté d'aiglehub.
 *
 * Wave envoie :
 * - type: 'checkout.session.completed' | 'checkout.session.payment_failed'
 * - data.client_reference comme référence interne
 */
export class WaveWebhookNormalizer {
  private static readonly EVENT_MAP: Record<string, 'success' | 'failed'> = {
    'checkout.session.completed': 'success',
    'checkout.session.payment_failed': 'failed',
  }

  static normalize(type: string, data: Record<string, any>): ProviderWebhookEvent | null {
    const outcome = WaveWebhookNormalizer.EVENT_MAP[type]
    if (!outcome) return null

    const reference = data.client_reference
    if (!reference) return null

    return {
      reference,
      outcome,
      operationType: 'checkout',
      providerName: 'wave',
      providerReference: data.id ?? null,
      errorMessage: outcome === 'failed' ? (data.last_payment_error?.message ?? null) : null,
      rawData: data,
    }
  }

  static isSupported(type: string): boolean {
    return type in WaveWebhookNormalizer.EVENT_MAP
  }
}
