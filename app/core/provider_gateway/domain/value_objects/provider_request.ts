interface ProviderRequestProps {
  transactionId: string
  amount: number
  currency: string
  /** Nom du gateway cible (ex. 'hub2'). Validé par le registry à la résolution. */
  provider: string
  phoneNumber: string | null
  country: string | null
  customerReference: string | null
  metadata: Record<string, unknown>
}

/**
 * Requête normalisée vers un provider (données découplées des spécificités HTTP).
 * Adapté d'aiglehub (classe + factory `create` avec validation, sans base VO).
 *
 * Product-agnostic : plus de `marchand*` (concept business). `customerReference`
 * est un libellé générique que les adapters qui en ont besoin passent à l'opérateur.
 */
export class ProviderRequest {
  private constructor(private readonly props: ProviderRequestProps) {}

  static create(params: {
    transactionId: string
    amount: number
    currency: string
    provider: string
    phoneNumber?: string | null
    country?: string | null
    customerReference?: string | null
    metadata?: Record<string, unknown>
  }): ProviderRequest {
    if (!params.transactionId) {
      throw new Error('ProviderRequest requires a transactionId')
    }

    if (params.amount <= 0) {
      throw new Error('ProviderRequest amount must be positive')
    }

    return new ProviderRequest({
      transactionId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      provider: params.provider,
      phoneNumber: params.phoneNumber ?? null,
      country: params.country ?? null,
      customerReference: params.customerReference ?? null,
      metadata: params.metadata ?? {},
    })
  }

  get transactionId(): string {
    return this.props.transactionId
  }

  get amount(): number {
    return this.props.amount
  }

  get currency(): string {
    return this.props.currency
  }

  get provider(): string {
    return this.props.provider
  }

  get phoneNumber(): string | null {
    return this.props.phoneNumber
  }

  get country(): string | null {
    return this.props.country
  }

  get customerReference(): string | null {
    return this.props.customerReference
  }

  get metadata(): Record<string, unknown> {
    return { ...this.props.metadata }
  }
}
