import { Exception } from '@adonisjs/core/exceptions'

/**
 * Aucun provider ne couvre le contexte demandé (rail/operator/country/operation).
 */
export class NoProviderForContextError extends Exception {
  static status = 422
  static code = 'E_NO_PROVIDER_FOR_CONTEXT'

  constructor(
    public readonly context: {
      rail: string
      operator: string
      country: string | null
      operation: string
    }
  ) {
    super(
      `No provider for context: rail=${context.rail}, operator=${context.operator}, ` +
        `country=${context.country ?? '*'}, operation=${context.operation}`,
      { status: NoProviderForContextError.status, code: NoProviderForContextError.code }
    )
  }
}
