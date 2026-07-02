import { Exception } from '@adonisjs/core/exceptions'

/**
 * Erreur levée quand un provider non supporté est demandé (introuvable dans le registry).
 */
export class ProviderNotSupportedError extends Exception {
  static status = 500
  static code = 'E_PROVIDER_NOT_SUPPORTED'

  constructor(public readonly providerName: string) {
    super(`Provider not supported: "${providerName}"`, {
      status: ProviderNotSupportedError.status,
      code: ProviderNotSupportedError.code,
    })
  }
}
