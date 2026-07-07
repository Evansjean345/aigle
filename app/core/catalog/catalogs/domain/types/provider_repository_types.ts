import type { ProviderType, ProviderStatus } from '#core/catalog/catalogs/domain/enums/provider_enums'

/**
 * Contrat d'entrée du port `ProviderRepository` (domaine). Ces types définissent le vocabulaire du
 * repository ; l'application construit les Command depuis ses RequestDto HTTP. Placés en domain
 * pour que le port ne dépende pas de la couche application (DDD strict).
 */
export interface ListProvidersQuery {
  page?: number
  limit?: number
  q?: string
  type?: ProviderType
  status?: ProviderStatus
}

export interface CreateProviderCommand {
  code: string
  name: string
  type: ProviderType
  logo?: string | null
}

export interface UpdateProviderCommand {
  code?: string
  name?: string
  type?: ProviderType
  logo?: string | null
}
