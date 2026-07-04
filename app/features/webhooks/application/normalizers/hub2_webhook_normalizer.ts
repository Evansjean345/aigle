import type { ProviderWebhookEvent } from '#features/webhooks/domain/value_objects/provider_webhook_event'

/**
 * Normalise les webhooks Hub2 en `ProviderWebhookEvent` (Lot 3b). Porté d'aiglehub.
 *
 * Hub2 envoie :
 * - type: 'payment_intent.succeeded' | 'payment_intent.payment_failed' | 'transfer.succeeded'
 *         | 'transfer.failed'
 * - data.purchaseReference (checkout) ou data.reference (transfer)
 */
export class Hub2WebhookNormalizer {
  private static readonly EVENT_MAP: Record<
    string,
    { outcome: 'success' | 'failed'; operationType: 'checkout' | 'payout' }
  > = {
    'payment_intent.succeeded': { outcome: 'success', operationType: 'checkout' },
    'payment_intent.payment_failed': { outcome: 'failed', operationType: 'checkout' },
    'transfer.succeeded': { outcome: 'success', operationType: 'payout' },
    'transfer.failed': { outcome: 'failed', operationType: 'payout' },
  }

  static normalize(type: string, data: Record<string, any>): ProviderWebhookEvent | null {
    const mapping = Hub2WebhookNormalizer.EVENT_MAP[type]
    if (!mapping) return null

    const reference = mapping.operationType === 'checkout' ? data.purchaseReference : data.reference
    if (!reference) return null

    let errorMessage: string | null = null

    if (mapping.outcome === 'failed') {
      errorMessage =
        data.lastPaymentFailure?.message || data.failureCause?.message || 'Payment failed'
    }

    return {
      reference,
      outcome: mapping.outcome,
      operationType: mapping.operationType,
      providerName: 'hub2',
      providerReference: data.id ?? null,
      errorMessage,
      rawData: data,
    }
  }

  static isSupported(type: string): boolean {
    return type in Hub2WebhookNormalizer.EVENT_MAP
  }
}
