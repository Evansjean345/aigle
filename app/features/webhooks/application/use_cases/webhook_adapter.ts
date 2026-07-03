import { Exception } from '@adonisjs/core/exceptions'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import type { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import type { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'

/**
 * Briques d'adaptateur entrant partagées par les handlers de webhook (Lot 3).
 *
 * Concerns purement HTTP/adaptateur (validation de forme du payload, extraction de la réponse
 * opérateur, réponse standard) — AUCUNE logique argent, qui vit dans `engine.settle`.
 */

export const WEBHOOK_SUCCESS_RESPONSE: WebhookResponseDto = {
  status: 200,
  message: 'received',
} as const

/** Valide la forme minimale du payload (référence + statut présents). */
export function validateWebhookPayload(payload: WebhookRequestDto): void {
  if (!payload?.data?.reference) {
    paymentLog.warn('WEBHOOK_REFERENCE_REQUIRED', { webhook: payload?.data }, 'Missing reference')
    throw new Exception('Invalid payload: Missing reference', {
      status: 422,
      code: 'WEBHOOK_REFERENCE_REQUIRED',
    })
  }

  if (!payload?.data?.status) {
    paymentLog.warn('WEBHOOK_STATUS_REQUIRED', { webhook: payload?.data }, 'Missing status')
    throw new Exception('Invalid payload: Missing status', {
      status: 422,
      code: 'WEBHOOK_STATUS_REQUIRED',
    })
  }
}

/** Extrait la réponse opérateur + l'erreur du payload (passées à `engine.settle`). */
export function buildOperatorResponse(payload: WebhookRequestDto): {
  operatorResponse: any
  error: any
} {
  return {
    operatorResponse: payload.data,
    error: payload.error || payload.data?.error || null,
  }
}
