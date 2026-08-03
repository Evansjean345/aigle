import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

export default class MakeRootRole extends BaseCommand {
  static commandName = 'make:root-role'
  static description = 'Crée le rôle root et lui attache toutes les permissions du catalogue'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Crée le rôle `root` s'il n'existe pas, puis lui attache l'intégralité du catalogue.
   *
   * N'attache que les permissions déclarées en code : une permission présente en base mais absente
   * du catalogue reste hors du rôle. À rejouer après tout ajout de permission, sans quoi `root` se
   * verra refuser les gardes correspondantes.
   *
   * @return {Promise<void>} Résout quand le rôle est à jour.
   */
  async run(): Promise<void> {
    const slugs = ADMIN_PERMISSION_CATALOG.map((definition) => definition.slug)
    const permissions = await Permission.query().whereIn('slug', slugs)

    if (permissions.length !== slugs.length) {
      const persisted = new Set(permissions.map((permission) => permission.slug))
      const missing = slugs.filter((slug) => !persisted.has(slug))

      this.logger.error(
        `${missing.length} permission(s) du catalogue absente(s) de la base — lancez « node ace permissions:sync » d'abord :`
      )

      for (const slug of missing) {
        this.logger.log(`  ! ${slug}`)
      }

      this.exitCode = 1
      return
    }

    const rootRole = await Role.updateOrCreate(
      { slug: 'root' },
      { name: 'Root', description: 'Administrateur système avec toutes les permissions' }
    )

    await rootRole.related('permissions').sync(permissions.map((permission) => permission.id))

    this.logger.success(
      `${permissions.length} permission(s) du catalogue attachée(s) au rôle root.`
    )
  }
}
