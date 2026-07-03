import { inject } from '@adonisjs/core'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import type { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import {
  WEBHOOK_SUCCESS_RESPONSE,
  validateWebhookPayload,
  buildOperatorResponse,
} from '#features/webhooks/application/use_cases/webhook_adapter'

/**
 * Adaptateur entrant du webhook transfert (Lot 3).
 *
 * Routeur mince : valide le payload, mappe le statut → outcome, délègue à `engine.settle`
 * (qui possède TOUTE la mécanique argent, refund inclus), répond. Aucune logique argent ici.
 */
@inject()
export default class HandleTransfertWebhookUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    validateWebhookPayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'TRANSFER_WEBHOOK_RECEIVED',
      { webhook: { reference, status } },
      'Received transfer webhook'
    )

    // Statut non terminal (ni SUCCESS ni FAILED) : no-op idempotent (parité comportement actuel).
    if (status !== TransactionStatus.SUCCESS && status !== TransactionStatus.FAILED) {
      paymentLog.warn(
        'TRANSFER_WEBHOOK_UNKNOWN_STATUS',
        { webhook: { reference, status } },
        'Webhook received with unhandled status'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    }

    const { operatorResponse, error } = buildOperatorResponse(payload)

    await this.engine.settle({
      reference,
      kind: 'transfert',
      outcome: status === TransactionStatus.SUCCESS ? 'success' : 'failure',
      operatorResponse,
      error,
    })

    paymentLog.info(
      'TRANSFER_WEBHOOK_PROCESSED',
      { webhook: { reference, status } },
      'Transfer webhook processed successfully'
    )
    return WEBHOOK_SUCCESS_RESPONSE
  }
}
