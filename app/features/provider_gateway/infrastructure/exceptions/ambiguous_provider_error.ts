/**
 * Plusieurs providers sont également spécifiques ET de même priorité pour un
 * contexte donné : la configuration est ambiguë et doit être corrigée
 * (priorité distincte), plutôt que de choisir arbitrairement.
 */
export class AmbiguousProviderError extends Error {
  constructor(
    public readonly context: { rail: string; operator: string; country: string | null },
    public readonly candidates: string[]
  ) {
    super(
      `Ambiguous provider selection for rail=${context.rail}, operator=${context.operator}, ` +
        `country=${context.country ?? '*'} — candidates: ${candidates.join(', ')}. ` +
        `Distinguish them with a priority.`
    )
    this.name = 'AmbiguousProviderError'
  }
}
