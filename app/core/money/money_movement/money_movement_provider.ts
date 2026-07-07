import type { ApplicationService } from '@adonisjs/core/types'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import MoneyMovementEngineImpl from '#core/money/money_movement/application/services/money_movement_engine_impl'
import ExternalMovementGateway from '#core/money/money_movement/domain/interfaces/external_movement_gateway'
import ProviderGatewayAdapter from '#core/money/money_movement/infrastructure/gateways/provider_gateway_adapter'

/**
 * Wiring de la feature money_movement (core argent).
 *
 * - Binde le contrat `MoneyMovementEngine` sur sa façade (résolue via le conteneur pour son DI).
 * - Binde le port `ExternalMovementGateway` sur `ProviderGatewayAdapter` (routage in-process via
 *   la feature provider_gateway). aiglehub est absorbé — aiglesend est la couche racine (Hub2/Wave
 *   adressés directement) ; le chemin HTTP vers aiglehub est supprimé (Lot 3b).
 *
 * Binding **transient** (`bind`, pas `singleton`) : l'engine et le gateway sont des orchestrateurs
 * sans état, résolus par requête via les use cases. Le transient garde la couture testable (un
 * `container.swap` d'un test se propage à une chaîne fraîchement résolue, là où un singleton
 * figerait la dépendance captée à la 1ʳᵉ résolution) — sans coût en prod.
 */
export default class MoneyMovementProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(MoneyMovementEngine, () => {
      return this.app.container.make(MoneyMovementEngineImpl)
    })

    this.app.container.bind(ExternalMovementGateway, () => {
      return this.app.container.make(ProviderGatewayAdapter)
    })
  }
}
