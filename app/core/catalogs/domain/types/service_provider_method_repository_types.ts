/**
 * Contrat d'entrée du port `ServiceProviderMethodRepository` (domaine). Placés en domain pour que
 * le port ne dépende pas de la couche application (DDD strict) ; l'application construit les Command
 * depuis ses RequestDto HTTP.
 */
export interface ListServiceProviderMethodsQuery {
  page?: number
  limit?: number
  isActive?: boolean
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
  providerToId?: number
  /**
   * Filtre par type de réseau:
   * - 'inter': uniquement les inter-réseaux (providerFrom != providerTo et providerTo != null)
   * - 'intra': uniquement les intra-réseaux (providerFrom == providerTo ou providerTo == null)
   * - undefined: tous
   */
  networkType?: 'inter' | 'intra'
}

export interface CreateServiceProviderMethodCommand {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number | null
  feeFixed?: bigint | number
  feePercent?: number
  minAmount?: number
  currency?: string
  isActive?: boolean
}

export interface UpdateServiceProviderMethodCommand {
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
  providerToId?: number | null
  feeFixed?: bigint | number
  feePercent?: number
  minAmount?: number
  currency?: string
  isActive?: boolean
}
