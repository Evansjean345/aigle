/**
 * Opération de provider inconnue passée à l'invocation (ni `checkout` ni `payout`).
 *
 * Garde d'exhaustivité : normalement INATTEIGNABLE en code bien typé (`ProviderOperation` est
 * une union fermée). Levée uniquement si une opération invalide contourne le typage.
 */
export class UnsupportedProviderOperationError extends Error {
  constructor(public readonly operation: string) {
    super(`Unsupported provider operation: "${operation}"`)
    this.name = 'UnsupportedProviderOperationError'
  }
}
