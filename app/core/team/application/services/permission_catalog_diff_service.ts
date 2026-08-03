import { inject } from '@adonisjs/core'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import type Permission from '#core/team/domain/models/permission'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'

/** Écart entre le catalogue déclaré en code et la table des permissions. */
export interface PermissionCatalogDiff {
  /** Déclarées au catalogue, absentes de la base : leur garde refuse tout le monde sauf `root`. */
  missing: PermissionDefinition[]
  /** Présentes des deux côtés, mais dont le libellé ou la description a changé en code. */
  outdated: PermissionDefinition[]
  /** Présentes en base et absentes du catalogue : inertes tant qu'aucun rôle ne les porte. */
  unknown: Permission[]
}

@inject()
export default class PermissionCatalogDiffService {
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Compare un catalogue déclaré en code à l'état de la table des permissions.
   *
   * Le catalogue est passé en argument plutôt qu'importé : il est assemblé au démarrage de
   * l'application, une couche au-dessus de ce service.
   *
   * @param {readonly PermissionDefinition[]} catalog - Les permissions déclarées par les features.
   * @return {Promise<PermissionCatalogDiff>} Les trois familles d'écart.
   */
  async compare(catalog: readonly PermissionDefinition[]): Promise<PermissionCatalogDiff> {
    const persisted = await this.permissionRepository.all()
    const bySlug = new Map(persisted.map((permission) => [permission.slug, permission]))

    const missing: PermissionDefinition[] = []
    const outdated: PermissionDefinition[] = []

    for (const definition of catalog) {
      const match = bySlug.get(definition.slug)

      if (!match) {
        missing.push(definition)
        continue
      }

      if (match.name !== definition.name || match.description !== definition.description) {
        outdated.push(definition)
      }
    }

    const declared = new Set<string>(catalog.map((definition) => definition.slug))
    const unknown = persisted.filter((permission) => !declared.has(permission.slug))

    return { missing, outdated, unknown }
  }
}
