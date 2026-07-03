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
 * Adaptateur entrant du webhook deposit (Lot 3).
 *
 * Routeur mince : valide le payload, mappe le statut opérateur → outcome, délègue à `engine.settle`
 * (qui possède TOUTE la mécanique argent), répond. Aucune logique argent ici.
 */
@inject()
export default class HandleDepositWebhookUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    validateWebhookPayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'DEPOSIT_WEBHOOK_RECEIVED',
      { webhook: { reference, status } },
      'Received deposit webhook'
    )

    // Statut non terminal (ni SUCCESS ni FAILED) : no-op idempotent (parité comportement actuel).
    if (status !== TransactionStatus.SUCCESS && status !== TransactionStatus.FAILED) {
      paymentLog.warn(
        'DEPOSIT_WEBHOOK_UNKNOWN_STATUS',
        { webhook: { reference, status } },
        'Webhook received with unhandled status'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    }

    const { operatorResponse, error } = buildOperatorResponse(payload)

    await this.engine.settle({
      reference,
      kind: 'deposit',
      outcome: status === TransactionStatus.SUCCESS ? 'success' : 'failure',
      operatorResponse,
      error,
    })

    paymentLog.info(
      'DEPOSIT_WEBHOOK_PROCESSED',
      { webhook: { reference, status } },
      'Deposit webhook processed successfully'
    )
    return WEBHOOK_SUCCESS_RESPONSE
  }
}
