import type { ProviderRequest } from '#core/money/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#core/money/provider_gateway/domain/value_objects/provider_response'
import type { ProviderOperation } from '#core/money/provider_gateway/domain/types/provider_capabilities'
import type { ProviderPollResult } from '#core/money/provider_gateway/domain/types/provider_poll'

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

  /**
   * Interroge le statut d'un mouvement **déjà initié** (B6 — réconciliation d'un PENDING orphelin
   * dont le webhook n'est jamais arrivé).
   *
   * **Optionnel** : tous les providers n'exposent pas endpoint de statut. Un provider sans
   * `pollStatus` n'est simplement pas réconciliable automatiquement (ses mouvements orphelins
   * finissent en revue manuelle) — plutôt que de forcer une implémentation bidon dans chaque adapter.
   */
  pollStatus?(operation: ProviderOperation, providerReference: string): Promise<ProviderPollResult>

  /** Identifiant unique du provider. */
  readonly providerName: string
}
