import { Exception } from '@adonisjs/core/exceptions'

/**
 * Plusieurs providers sont également spécifiques ET de même priorité pour un
 * contexte donné : la configuration est ambiguë et doit être corrigée
 * (priorité distincte), plutôt que de choisir arbitrairement.
 */
export class AmbiguousProviderError extends Exception {
  static status = 500
  static code = 'E_AMBIGUOUS_PROVIDER'

  constructor(
    public readonly context: { rail: string; operator: string; country: string | null },
    public readonly candidates: string[]
  ) {
    super(
      `Ambiguous provider selection for rail=${context.rail}, operator=${context.operator}, ` +
        `country=${context.country ?? '*'} — candidates: ${candidates.join(', ')}. ` +
        `Distinguish them with a priority.`,
      { status: AmbiguousProviderError.status, code: AmbiguousProviderError.code }
    )
  }
}
