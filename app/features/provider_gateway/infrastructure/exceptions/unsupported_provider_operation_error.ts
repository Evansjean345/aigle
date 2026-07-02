import { Exception } from '@adonisjs/core/exceptions'

/**
 * Opération de provider inconnue passée à l'invocation (ni `checkout` ni `payout`).
 *
 * Garde d'exhaustivité : normalement INATTEIGNABLE en code bien typé (`ProviderOperation` est
 * une union fermée). Levée uniquement si une opération invalide contourne le typage.
 */
export class UnsupportedProviderOperationError extends Exception {
  static status = 500
  static code = 'E_UNSUPPORTED_PROVIDER_OPERATION'

  constructor(public readonly operation: string) {
    super(`Unsupported provider operation: "${operation}"`, {
      status: UnsupportedProviderOperationError.status,
      code: UnsupportedProviderOperationError.code,
    })
  }
}
