import { inject } from '@adonisjs/core'
import FeeCalculatorService, {
  type FeeCalculationResult,
} from '#features/fees/application/services/fee_calculator_service'
import type { FeeContextInput } from '#features/money_movement/domain/types/money_movement_types'

/**
 * Brique partagée de l'engine : résout les frais d'un mouvement à partir du `feeContext`
 * (IDs catalogue product-agnostic) via le service core `fees`. Centralise l'unique point de
 * calcul des frais du core argent (L2-D6) — chaque handler l'appelle plutôt que de reproduire
 * l'appel au FeeCalculatorService.
 */
@inject()
export default class FeeResolver {
  constructor(private readonly feeCalculatorService: FeeCalculatorService) {}

  /** `feeContext` + montant demandé → { amount, fees, total }. */
  resolve(feeContext: FeeContextInput, amount: number): Promise<FeeCalculationResult> {
    return this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: feeContext.serviceTypeId,
        paymentMethodId: feeContext.paymentMethodId,
        providerFromId: feeContext.providerFromId,
        providerToId: feeContext.providerToId,
      },
      { amount, operation: 'subtract', include_fees: feeContext.includeFees }
    )
  }
}
