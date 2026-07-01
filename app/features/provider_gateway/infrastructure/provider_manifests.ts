import type { ProviderManifest } from '#features/provider_gateway/infrastructure/provider_manifest'
import { hub2Manifest } from '#features/provider_gateway/infrastructure/adapters/hub2/hub2_manifest'

/**
 * Liste centrale des providers payment ACTIFS. Source unique d'enregistrement.
 *
 * Activer/ajouter un provider = ajouter son manifeste ici (une ligne).
 * NB : Wave a un adapter + manifeste (`waveManifest`) mais reste DORMANT — non
 * listé ici, donc l'opérateur `wave` est routé via Hub2.
 */
export const PROVIDER_MANIFESTS: ProviderManifest[] = [hub2Manifest]
