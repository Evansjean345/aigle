import type { PaymentProviderPort } from '#features/provider_gateway/domain/interfaces/payment_provider_port'
import type { ProviderCapabilities } from '#features/provider_gateway/domain/types/provider_capabilities'

/**
 * Manifeste d'un provider payment : déclaré par chaque provider, agrégé par
 * `provider_manifests.ts`, chargé dans le `ProviderRegistry` au démarrage.
 *
 * `capabilities` alimente le `ProviderRouter` (sélection par contexte).
 * Ajouter un provider = créer son manifeste + l'ajouter à la liste centrale.
 *
 * (Airtime hors périmètre — CF11 : reste côté aiglehub.)
 */
export interface ProviderManifest {
  name: string
  capabilities: ProviderCapabilities
  create: () => PaymentProviderPort
}
