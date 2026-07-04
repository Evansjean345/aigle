import { inject } from '@adonisjs/core'
import ExternalMovementGateway from '#core/money_movement/domain/interfaces/external_movement_gateway'
import ExternalInitiationRunner from '#core/money_movement/application/services/external_initiation_runner'
import type {
  ExternalSecondLegInitiation,
  ExternalInitiationResult,
} from '#core/money_movement/domain/types/money_movement_types'

/**
 * Use case core : initiation de la JAMBE 2 d'un inter-réseau (cash-out → bénéficiaire).
 *
 * Continuation de la saga déclenchée par le règlement de la jambe 1. Passe par le port
 * `ExternalMovementGateway` (local depuis le Lot 3b). Sur échec provider, le runner marque le
 * mouvement FAILED + classe/reporte/notifie (aucun wallet à re-créditer — Aigle en pont).
 */
@inject()
export default class InitiateInterSecondLegUseCase {
  constructor(
    private readonly gateway: ExternalMovementGateway,
    private readonly runner: ExternalInitiationRunner
  ) {}

  handle(ctx: ExternalSecondLegInitiation): Promise<ExternalInitiationResult> {
    return this.runner.run(
      {
        transactionId: ctx.transactionId,
        transactionReference: ctx.transactionReference,
        paymentId: ctx.paymentId,
        operator: ctx.operator,
        paymentMethod: ctx.paymentMethod,
        logCode: 'INTER_TRANSFER_SECOND_STEP',
        failureEvent: 'TransfertInterTransactionFailed',
        failureEventData: { reference: ctx.transactionReference, amount: ctx.amount },
      },
      () => this.gateway.initiateSecondLeg(ctx)
    )
  }
}
