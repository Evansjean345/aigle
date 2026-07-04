import { inject } from '@adonisjs/core'
import FeeCalculatorService, {
  type FeeCalculationResult,
} from '#core/fees/application/services/fee_calculator_service'
import CatalogResolver from '#core/catalogs/application/services/catalog_resolver'
import type { FeeContextInput } from '#core/money_movement/domain/types/money_movement_types'

/**
 * Brique partagée de l'engine : résout les frais d'un mouvement à partir du `feeContext`
 * (codes métier, ADR-0013). Résout d'abord les codes en IDs catalogue via le `CatalogResolver`
 * (money-core → catalogs-core, porte unique), puis délègue le calcul au service core `fees`.
 * Centralise l'unique point de tarification du core argent (L2-D6) — chaque use case l'appelle
 * plutôt que de reproduire la résolution + le calcul.
 */
@inject()
export default class FeeResolver {
  constructor(
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly catalogResolver: CatalogResolver
  ) {}

  /** `feeContext` (codes) + montant demandé → { amount, fees, total }. */
  async resolve(feeContext: FeeContextInput, amount: number): Promise<FeeCalculationResult> {
    const ids = await this.catalogResolver.resolveFeeContext({
      serviceTypeCode: feeContext.serviceTypeCode,
      paymentMethodCode: feeContext.paymentMethodCode,
      providerFromCode: feeContext.providerFromCode,
      providerToCode: feeContext.providerToCode,
    })

    return this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: ids.serviceTypeId,
        paymentMethodId: ids.paymentMethodId,
        providerFromId: ids.providerFromId,
        providerToId: ids.providerToId,
      },
      { amount, operation: 'subtract', include_fees: feeContext.includeFees }
    )
  }
}
