import { inject } from '@adonisjs/core'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'
import UnknownRolePermissionException from '#core/team/domain/exceptions/unknown_role_permission_exception'
import EmptyRolePermissionsException from '#core/team/domain/exceptions/empty_role_permissions_exception'

@inject()
export default class RolePermissionGuard {
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Vérifie qu'un rôle ne reçoit que des permissions déclarées en code.
   *
   * Sans cette garde, un identifiant quelconque serait accepté — y compris celui d'une permission
   * restée en base après avoir disparu du catalogue, qu'aucun endpoint ne vérifie plus.
   *
   * @param {number[]} permissionIds - Les identifiants soumis pour composer le rôle.
   * @param {readonly PermissionDefinition[]} catalog - Les permissions déclarées par les features.
   * @return {Promise<void>} Résout si toutes les permissions appartiennent au catalogue.
   * @throws {EmptyRolePermissionsException} Aucune permission n'est soumise.
   * @throws {UnknownRolePermissionException} Un identifiant ne correspond à aucune permission déclarée.
   */
  async assertBelongsToCatalog(
    permissionIds: number[],
    catalog: readonly PermissionDefinition[]
  ): Promise<void> {
    if (permissionIds.length === 0) {
      throw new EmptyRolePermissionsException()
    }

    const persisted = await this.permissionRepository.findByIds(permissionIds)
    const declared = new Set<string>(catalog.map((definition) => definition.slug))

    const slugById = new Map(persisted.map((permission) => [permission.id, permission.slug]))
    const rejected: string[] = []

    for (const id of permissionIds) {
      const slug = slugById.get(id)

      if (slug === undefined) {
        rejected.push(`#${id}`)
        continue
      }

      if (!declared.has(slug)) {
        rejected.push(slug)
      }
    }

    if (rejected.length > 0) {
      throw new UnknownRolePermissionException(rejected)
    }
  }
}
