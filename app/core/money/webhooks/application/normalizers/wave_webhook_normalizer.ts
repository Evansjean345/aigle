import type { ProviderWebhookEvent } from '#core/money/webhooks/domain/value_objects/provider_webhook_event'
import ErrorMessageTranslator from '#core/money/provider_gateway/infrastructure/error_message_translator'
import { WAVE_CLIENT_ERRORS } from '#core/money/provider_gateway/infrastructure/adapters/wave/wave_client_errors'

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

    let errorMessage: string | null = null
    let errorCode: string | null = null

    if (outcome === 'failed') {
      errorMessage = data.last_payment_error?.message ?? null
      const nativeCode = data.last_payment_error?.code ?? data.code ?? null

      if (nativeCode) {
        errorCode = ErrorMessageTranslator.translate(
          { errorCode: nativeCode, providerName: 'wave', rawData: data },
          WAVE_CLIENT_ERRORS
        ).code
      }
    }

    return {
      reference,
      outcome,
      operationType: 'checkout',
      providerName: 'wave',
      providerReference: data.id ?? null,
      errorCode,
      errorMessage,
      rawData: data,
    }
  }

  static isSupported(type: string): boolean {
    return type in WaveWebhookNormalizer.EVENT_MAP
  }
}
