import { inject } from '@adonisjs/core'
import { ProviderRegistry } from '#core/provider_gateway/infrastructure/provider_registry'
import { ProviderRouter } from '#core/provider_gateway/application/services/provider_router'
import { PROVIDER_MANIFESTS } from '#core/provider_gateway/infrastructure/provider_manifests'
import type { PaymentProviderPort } from '#core/provider_gateway/domain/interfaces/payment_provider_port'
import type { ProviderOperation } from '#core/provider_gateway/domain/types/provider_capabilities'
import type { ProviderRequest } from '#core/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#core/provider_gateway/domain/value_objects/provider_response'
import { UnsupportedProviderOperationError } from '#core/provider_gateway/infrastructure/exceptions/unsupported_provider_operation_error'

/**
 * Contrat d'entrée du routeur, indépendant des agrégats des autres features.
 * Union fermée = vocabulaire des rails aligné sur les codes DB (langage commun).
 * (Airtime hors périmètre — CF11.)
 */
export type RoutableOperation = 'mobile-money' | 'credit-card'

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
    const providerName = ProviderRouter.resolve(PROVIDER_MANIFESTS, {
      rail: input.operationType,
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
        throw new UnsupportedProviderOperationError(operation satisfies never)
    }
  }
}
