import type { ProviderManifest } from '#core/provider_gateway/infrastructure/provider_manifest'
import { Hub2Adapter } from '#core/provider_gateway/infrastructure/adapters/hub2/hub2_adapter'

/**
 * Manifeste du gateway Hub2 (mobile money, agrège orange/moov/mtn/wave).
 * `operators` inclut `wave` → Wave est routé via Hub2 tant qu'aucun manifeste
 * Wave autonome n'est activé.
 */
export const hub2Manifest: ProviderManifest = {
  name: 'hub2',
  capabilities: {
    rail: 'mobile-money',
    operations: ['checkout', 'payout'],
    operators: ['orange', 'moov', 'mtn', 'wave'],
    // countries: absent → multi-pays
    priority: 5,
  },
  create: () => new Hub2Adapter(),
}
