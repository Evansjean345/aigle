/**
 * Erreur levée quand un provider non supporté est demandé.
 */
export class ProviderNotSupportedError extends Error {
  constructor(public readonly providerName: string) {
    super(`Provider not supported: "${providerName}"`)
    this.name = 'ProviderNotSupportedError'
  }
}
