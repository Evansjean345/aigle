import { inject } from '@adonisjs/core'
import ExternalMovementStrategy from '#features/money_movement/domain/interfaces/external_movement_strategy'
import type {
  ExternalSecondLegInitiation,
  ExternalInitiationResult,
} from '#features/money_movement/domain/types/money_movement_types'

/**
 * Use case core : initiation de la JAMBE 2 d'un inter-réseau (cash-out → bénéficiaire).
 *
 * Continuation de la saga déclenchée par le règlement de la jambe 1. Comme toute initiation
 * externe, passe par le port `ExternalMovementStrategy` (http aujourd'hui, local au 3b) — la
 * jambe 2 n'est plus un job brut dispatché hors de l'engine.
 */
@inject()
export default class InitiateInterSecondLegUseCase {
  constructor(private readonly strategy: ExternalMovementStrategy) {}

  handle(ctx: ExternalSecondLegInitiation): Promise<ExternalInitiationResult> {
    return this.strategy.initiateSecondLeg(ctx)
  }
}
