import type { ApplicationService } from '@adonisjs/core/types'
import { ProviderRegistry } from '#features/provider_gateway/infrastructure/provider_registry'
import { PROVIDER_MANIFESTS } from '#features/provider_gateway/infrastructure/provider_manifests'

/**
 * Wiring de la feature provider_gateway : enregistre le registre des providers,
 * alimenté automatiquement depuis les manifestes (PROVIDER_MANIFESTS).
 *
 * Ajouter/activer un gateway = créer/ajouter son manifeste à la liste centrale.
 */
export default class ProviderGatewayProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(ProviderRegistry, () => {
      const registry = new ProviderRegistry()

      for (const manifest of PROVIDER_MANIFESTS) {
        registry.register(manifest.create())
      }

      return registry
    })
  }

  /**
   * Garde-fou au démarrage : noms de manifestes uniques (sinon un provider en
   * écraserait silencieusement un autre) + résolution effective du registre
   * (valide que chaque `create()` fonctionne).
   */
  async boot() {
    const names = PROVIDER_MANIFESTS.map((m) => m.name)
    const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]

    if (duplicates.length > 0) {
      throw new Error(`[ProviderGateway] Manifestes en double : ${duplicates.join(', ')}`)
    }

    await this.app.container.make(ProviderRegistry)
  }
}
