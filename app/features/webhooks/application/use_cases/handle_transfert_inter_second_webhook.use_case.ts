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
 * Adaptateur entrant du webhook inter-réseau JAMBE 2 (Lot 3, jambe terminale).
 *
 * Routeur mince : valide, mappe le statut → outcome, délègue à `engine.settle({kind:
 * 'transfert_inter_second'})` (qui possède la mécanique argent + le règlement final), répond.
 */
@inject()
export default class HandleTransfertInterSecondWebhookUseCase {
  constructor(private readonly engine: MoneyMovementEngine) {}

  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    validateWebhookPayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'INTER_TRANSFER_SECOND_WEBHOOK_RECEIVED',
      { webhook: { status, reference } },
      'Inter-transfer second webhook received'
    )

    if (status !== TransactionStatus.SUCCESS && status !== TransactionStatus.FAILED) {
      paymentLog.warn(
        'INTER_TRANSFER_SECOND_UNEXPECTED_STATUS',
        { webhook: { reference, status } },
        `Unexpected status received: ${status}`
      )
      return WEBHOOK_SUCCESS_RESPONSE
    }

    const { operatorResponse, error } = buildOperatorResponse(payload)

    await this.engine.settle({
      reference,
      kind: 'transfert_inter_second',
      outcome: status === TransactionStatus.SUCCESS ? 'success' : 'failure',
      operatorResponse,
      error,
    })

    return WEBHOOK_SUCCESS_RESPONSE
  }
}
