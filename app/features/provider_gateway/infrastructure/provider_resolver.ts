import { inject } from '@adonisjs/core'
import { ProviderRegistry } from '#features/provider_gateway/infrastructure/provider_registry'
import { ProviderRouter } from '#features/provider_gateway/application/services/provider_router'
import { PROVIDER_MANIFESTS } from '#features/provider_gateway/infrastructure/provider_manifests'
import type { PaymentProviderPort } from '#features/provider_gateway/domain/interfaces/payment_provider_port'
import type {
  ProviderOperation,
  ProviderRail,
} from '#features/provider_gateway/domain/types/provider_capabilities'
import type { ProviderRequest } from '#features/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#features/provider_gateway/domain/value_objects/provider_response'

/**
 * Contrat d'entrée du routeur, indépendant des agrégats des autres features.
 * Type fermé pour que le mapping `railFor` soit vérifié à la compilation.
 * (Airtime hors périmètre — CF11.)
 */
export type RoutableOperation = 'mobile_money' | 'credit-card'

export interface ResolveProviderInput {
  operationType: RoutableOperation
  operator: string
  country: string | null
  operation: ProviderOperation
}

/**
 * Point d'entrée du routage : résout l'adapter pour un contexte, puis l'invoque.
 * Sélection déléguée au `ProviderRouter` (capability-based) ; instances tenues
 * par le `ProviderRegistry` (peuplé au démarrage depuis les manifests).
 */
@inject()
export class ProviderResolver {
  constructor(private readonly registry: ProviderRegistry) {}

  resolve(input: ResolveProviderInput): PaymentProviderPort {
    const rail = this.railFor(input.operationType)

    const providerName = ProviderRouter.resolve(PROVIDER_MANIFESTS, {
      rail,
      operator: input.operator,
      country: input.country,
      operation: input.operation,
    })

    return this.registry.get(providerName)
  }

  async invoke(
    adapter: PaymentProviderPort,
    operation: ProviderOperation,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    switch (operation) {
      case 'checkout':
        return adapter.checkout(request)
      case 'payout':
        return adapter.payout(request)
      default:
        throw new Error(`Unknown operation: ${operation satisfies never}`)
    }
  }

  /**
   * Mappe une opération routable vers son rail d'infrastructure.
   * La garde `never` force le traitement de tout nouveau RoutableOperation
   * à la compilation : pas de retour silencieux par défaut.
   */
  private railFor(operationType: RoutableOperation): ProviderRail {
    switch (operationType) {
      case 'credit-card':
        return 'card'
      case 'mobile_money':
        return 'mobile_money'
      default:
        throw new Error(`Unmapped operation type: ${operationType satisfies never}`)
    }
  }
}
