import type { ProviderManifest } from '#features/provider_gateway/infrastructure/provider_manifest'
import { WaveAdapter } from '#features/provider_gateway/infrastructure/adapters/wave/wave_adapter'

/**
 * Manifeste du gateway Wave (mobile money direct).
 *
 * DORMANT : PAS encore ajouté à `PROVIDER_MANIFESTS`. Tant qu'il ne l'est pas,
 * l'opérateur `wave` est routé via Hub2. Pour activer Wave en direct : ajouter
 * `waveManifest` à la liste. `operators: ['wave']` étant plus restrictif que
 * Hub2 (orange/moov/mtn/wave), Wave dominera alors le routage pour `wave`.
 */
export const waveManifest: ProviderManifest = {
  name: 'wave',
  capabilities: {
    rail: 'mobile-money',
    operations: ['checkout', 'payout'],
    operators: ['wave'],
    priority: 10,
  },
  create: () => new WaveAdapter(),
}
