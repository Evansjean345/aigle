import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type Permission from '#core/team/domain/models/permission'
import db from '@adonisjs/lucid/services/db'
import Role from '#core/team/domain/models/role'
import PermissionCatalogDiffService from '#core/team/application/services/permission_catalog_diff_service'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

export default class PermissionsPrune extends BaseCommand {
  static commandName = 'permissions:prune'
  static description = 'Supprime les permissions présentes en base et absentes du catalogue'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: "N'écrit rien : affiche ce que la suppression retirerait",
    default: false,
  })
  declare dryRun: boolean

  /**
   * Retire les permissions que plus aucun code ne déclare.
   *
   * Refuse de supprimer une permission encore attachée à un rôle : la clé étrangère est en cascade,
   * la suppression emporterait l'attribution sans le dire. Détacher relève d'une décision humaine.
   *
   * @return {Promise<void>} Résout quand la suppression est écrite, ou après l'aperçu.
   */
  async run(): Promise<void> {
    const diffService = await this.app.container.make(PermissionCatalogDiffService)
    const { unknown } = await diffService.compare(ADMIN_PERMISSION_CATALOG)

    if (unknown.length === 0) {
      this.logger.success('Aucune permission hors catalogue : rien à retirer.')
      return
    }

    const held = await this.rolesBySlug(unknown)
    const removable = unknown.filter((permission) => !held.has(permission.slug))
    const retained = unknown.filter((permission) => held.has(permission.slug))

    for (const permission of removable) {
      this.logger.log(`  - ${permission.slug} — ${permission.name}`)
    }

    if (retained.length > 0) {
      this.logger.warning(
        `${retained.length} permission(s) hors catalogue mais encore attachée(s) à un rôle — conservée(s) :`
      )

      for (const permission of retained) {
        this.logger.log(`  ! ${permission.slug} — portée par ${held.get(permission.slug)}`)
      }
    }

    if (this.dryRun) {
      this.logger.info(`Aperçu seul : ${removable.length} permission(s) seraient retirée(s).`)
      return
    }

    if (removable.length === 0) {
      this.logger.info('Aucune permission détachée à retirer.')
      return
    }

    await db.transaction(async (trx) => {
      await trx
        .from('permissions')
        .whereIn(
          'slug',
          removable.map((permission) => permission.slug)
        )
        .delete()
    })

    this.logger.success(`${removable.length} permission(s) retirée(s).`)
  }

  /**
   * Relève, pour chaque permission, les rôles qui la portent.
   *
   * @param {Permission[]} permissions - Les permissions à examiner.
   * @return {Promise<Map<string, string>>} Le slug de la permission vers les rôles qui la détiennent.
   */
  private async rolesBySlug(permissions: Permission[]): Promise<Map<string, string>> {
    const roles = await Role.query().preload('permissions')
    const held = new Map<string, string[]>()

    for (const role of roles) {
      for (const permission of role.permissions) {
        held.set(permission.slug, [...(held.get(permission.slug) ?? []), role.slug])
      }
    }

    const examined = new Set(permissions.map((permission) => permission.slug))

    return new Map(
      [...held.entries()]
        .filter(([slug]) => examined.has(slug))
        .map(([slug, roleSlugs]) => [slug, roleSlugs.join(', ')])
    )
  }
}
