import type {
  ProviderCapabilities,
  ProviderOperation,
  ProviderRail,
} from '#features/provider_gateway/domain/types/provider_capabilities'
import { NoProviderForContextError } from '#features/provider_gateway/infrastructure/exceptions/no_provider_for_context_error'
import { AmbiguousProviderError } from '#features/provider_gateway/infrastructure/exceptions/ambiguous_provider_error'

export interface RoutingContext {
  rail: ProviderRail
  operator: string
  country: string | null
  operation: ProviderOperation
}

export interface RoutableProvider {
  name: string
  capabilities: ProviderCapabilities
}

/**
 * Routeur de providers — capability-based, déterministe (pas de failover).
 *
 * Sélection : filtrer les providers qui matchent le contexte, puis garder le
 * plus RESTRICTIF (dominance). À restrictivité égale, départager par `priority`.
 * Toujours ex-aequo → erreur d'ambiguïté. Aucun match → NoProviderForContextError.
 */
export class ProviderRouter {
  static resolve(providers: RoutableProvider[], ctx: RoutingContext): string {
    const matches = providers.filter((p) => ProviderRouter.matches(p.capabilities, ctx))

    if (matches.length === 0) {
      throw new NoProviderForContextError(ctx)
    }

    if (matches.length === 1) {
      return matches[0].name
    }

    // 1. Un provider qui domine tous les autres (plus restrictif partout) gagne.
    const dominant = matches.find((candidate) =>
      matches.every(
        (other) =>
          other === candidate ||
          ProviderRouter.dominates(candidate.capabilities, other.capabilities)
      )
    )

    if (dominant) {
      return dominant.name
    }

    const maxPriority = Math.max(...matches.map((m) => m.capabilities.priority ?? 0))
    const top = matches.filter((m) => (m.capabilities.priority ?? 0) === maxPriority)

    if (top.length > 1) {
      throw new AmbiguousProviderError(
        ctx,
        top.map((t) => t.name)
      )
    }

    return top[0].name
  }

  /** Un provider matche-t-il le contexte ? (wildcard = absent = tous) */
  private static matches(cap: ProviderCapabilities, ctx: RoutingContext): boolean {
    if (cap.rail !== ctx.rail) return false
    if (!cap.operations.includes(ctx.operation)) return false
    if (cap.operators && !cap.operators.includes(ctx.operator)) return false

    if (cap.countries && (ctx.country === null || !cap.countries.includes(ctx.country))) {
      return false
    }

    return true
  }

  /**
   * `a` domine `b` s'il est au moins aussi restrictif sur toutes les dimensions
   * (operators, countries) et strictement plus sur au moins une.
   */
  private static dominates(a: ProviderCapabilities, b: ProviderCapabilities): boolean {
    const op = ProviderRouter.compareDimension(a.operators, b.operators)
    const co = ProviderRouter.compareDimension(a.countries, b.countries)

    return op >= 0 && co >= 0 && (op > 0 || co > 0)
  }

  /**
   * Compare la restrictivité de deux ensembles sur une dimension.
   * @returns > 0 si `a` est plus restrictif, < 0 si `b` l'est, 0 si égal.
   *
   * Règle : contraint (défini) > wildcard (absent) ; entre deux définis, la
   * plus petite liste est plus restrictive.
   */
  private static compareDimension(a?: string[], b?: string[]): number {
    const aConstrained = a !== undefined
    const bConstrained = b !== undefined

    if (aConstrained !== bConstrained) {
      return aConstrained ? 1 : -1
    }

    if (!aConstrained) {
      return 0 // les deux en wildcard
    }

    return b!.length - a!.length
  }
}
