/**
 * Requête normalisée vers un provider (données découplées des spécificités HTTP).
 * Adapté d'aiglehub (VO → interface + factory, style aiglesend).
 */
export interface ProviderRequest {
  transactionId: string
  amount: number
  currency: string
  /** Nom du gateway cible (ex. 'hub2'). Validé par le registry à la résolution. */
  provider: string
  phoneNumber: string | null
  country: string | null
  marchandName: string | null
  marchandId: string
  metadata: Record<string, unknown>
}

/** Construit une `ProviderRequest` normalisée, avec validation. */
export function createProviderRequest(params: {
  transactionId: string
  amount: number
  currency: string
  provider: string
  phoneNumber?: string | null
  country?: string | null
  marchandName?: string | null
  marchandId: string
  metadata?: Record<string, unknown>
}): ProviderRequest {
  if (!params.transactionId) {
    throw new Error('ProviderRequest requires a transactionId')
  }
  if (params.amount <= 0) {
    throw new Error('ProviderRequest amount must be positive')
  }

  return {
    transactionId: params.transactionId,
    amount: params.amount,
    currency: params.currency,
    provider: params.provider,
    phoneNumber: params.phoneNumber ?? null,
    country: params.country ?? null,
    marchandName: params.marchandName ?? null,
    marchandId: params.marchandId,
    metadata: params.metadata ?? {},
  }
}
