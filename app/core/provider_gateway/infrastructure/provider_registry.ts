import type { PaymentProviderPort } from '#core/provider_gateway/domain/interfaces/payment_provider_port'
import { ProviderNotSupportedError } from '#core/provider_gateway/infrastructure/exceptions/provider_not_supported_error'

/**
 * Registre des providers payment (payment-only — airtime hors périmètre, CF11).
 * Alimenté au démarrage depuis les manifests.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, PaymentProviderPort>()

  register(provider: PaymentProviderPort): void {
    this.providers.set(provider.providerName, provider)
  }

  get(name: string): PaymentProviderPort {
    const provider = this.providers.get(name)

    if (!provider) {
      throw new ProviderNotSupportedError(name)
    }
    return provider
  }

  has(name: string): boolean {
    return this.providers.has(name)
  }

  get registered(): string[] {
    return [...this.providers.keys()]
  }

  /** Reset pour les tests uniquement. */
  clear(): void {
    this.providers.clear()
  }
}
