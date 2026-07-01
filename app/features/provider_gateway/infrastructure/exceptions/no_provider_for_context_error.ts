/**
 * Aucun provider ne couvre le contexte demandé (rail/operator/country/operation).
 */
export class NoProviderForContextError extends Error {
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
        `country=${context.country ?? '*'}, operation=${context.operation}`
    )
    this.name = 'NoProviderForContextError'
  }
}
