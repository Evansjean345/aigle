import type { ApplicationService } from '@adonisjs/core/types'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import MoneyMovementEngineImpl from '#features/money_movement/application/services/money_movement_engine_impl'

/**
 * Wiring de la feature money_movement (core argent).
 *
 * Binde le contrat `MoneyMovementEngine` sur son implémentation. L'impl a des dépendances
 * `@inject()` (services core wallet/transactions/ledger/fees/validations) → on la résout via
 * le conteneur pour l'injection. La stratégie externe (`ExternalMovementStrategy`) sera bindée
 * au commit qui branche les primitives externes (deposit → …), http au Lot 2, local au 3b.
 */
export default class MoneyMovementProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(MoneyMovementEngine, () => {
      return this.app.container.make(MoneyMovementEngineImpl)
    })
  }
}
