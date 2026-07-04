import type { ProviderRequest } from '#core/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#core/provider_gateway/domain/value_objects/provider_response'

/**
 * Port définissant le contrat commun à tous les providers de paiement.
 * Chaque provider (Wave, Hub2…) l'implémente via un adapter — ajouter un
 * provider = un seul fichier adapter. Le domaine ignore les détails HTTP.
 *
 * Interface (et non abstract class) : les providers sont résolus dynamiquement
 * par le registry, pas injectés par ce type.
 */
export interface PaymentProviderPort {
  /** Checkout (pay-in : client → marchand). Retourne une URL de redirection ou une référence. */
  checkout(request: ProviderRequest): Promise<ProviderResponse>

  /** Payout (pay-out : marchand → bénéficiaire). */
  payout(request: ProviderRequest): Promise<ProviderResponse>

  /** Identifiant unique du provider. */
  readonly providerName: string
}
