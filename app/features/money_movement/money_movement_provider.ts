import type { ApplicationService } from '@adonisjs/core/types'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import MoneyMovementEngineImpl from '#features/money_movement/application/services/money_movement_engine_impl'
import ExternalMovementStrategy from '#features/money_movement/domain/interfaces/external_movement_strategy'
import LocalGatewayStrategy from '#features/money_movement/infrastructure/strategies/local_gateway_strategy'

/**
 * Wiring de la feature money_movement (core argent).
 *
 * - Binde le contrat `MoneyMovementEngine` sur sa façade (résolue via le conteneur pour son DI).
 * - Binde le port `ExternalMovementStrategy` sur la stratégie LOCALE (`local_gateway_strategy` :
 *   routage in-process via provider_gateway). aiglehub est absorbé — aiglesend est la couche
 *   racine (Hub2/Wave adressés directement) ; le chemin HTTP vers aiglehub est supprimé (Lot 3b).
 *
 * Binding **transient** (`bind`, pas `singleton`) : l'engine et la stratégie sont des
 * orchestrateurs sans état, résolus par requête via les use cases. Le transient garde la couture
 * testable (un `container.swap` d'un test se propage à une chaîne fraîchement résolue, là où un
 * singleton figerait la dépendance captée à la 1ʳᵉ résolution) — sans coût en prod.
 */
export default class MoneyMovementProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(MoneyMovementEngine, () => {
      return this.app.container.make(MoneyMovementEngineImpl)
    })

    this.app.container.bind(ExternalMovementStrategy, () => {
      return this.app.container.make(LocalGatewayStrategy)
    })
  }
}
