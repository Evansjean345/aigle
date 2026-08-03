import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import PermissionCatalogDiffService from '#core/team/application/services/permission_catalog_diff_service'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

export default class PermissionsCheck extends BaseCommand {
  static commandName = 'permissions:check'
  static description =
    'Vérifie que la base porte les permissions déclarées en code, sans rien écrire'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Échouer aussi sur les permissions présentes en base et absentes du catalogue',
    default: false,
  })
  declare strict: boolean

  /**
   * Constate l'écart entre le catalogue et la table des permissions.
   *
   * Sort en échec dès qu'une permission déclarée manque en base : sa garde refuserait alors tout le
   * monde sauf le rôle `root`. Un libellé divergent n'ouvre ni ne ferme aucune porte et ne fait pas
   * échouer ; une permission en base hors catalogue non plus, sauf en mode strict.
   *
   * @return {Promise<void>} Résout après le constat ; le code de sortie porte le verdict.
   */
  async run(): Promise<void> {
    const diffService = await this.app.container.make(PermissionCatalogDiffService)
    const diff = await diffService.compare(ADMIN_PERMISSION_CATALOG)

    this.logger.info(`Catalogue : ${ADMIN_PERMISSION_CATALOG.length} permission(s) déclarée(s).`)

    if (diff.missing.length > 0) {
      this.logger.error(
        `${diff.missing.length} permission(s) déclarée(s) en code et absente(s) de la base — la garde refuse tout le monde sauf « root » :`
      )

      for (const definition of diff.missing) {
        this.logger.log(`  ! ${definition.slug} — ${definition.name}`)
      }
    }

    for (const definition of diff.outdated) {
      this.logger.log(`  ~ ${definition.slug} — libellé divergent`)
    }

    if (diff.unknown.length > 0) {
      this.logger.warning(`${diff.unknown.length} permission(s) en base hors catalogue :`)

      for (const permission of diff.unknown) {
        this.logger.log(`  ? ${permission.slug} — ${permission.name}`)
      }
    }

    const failing = diff.missing.length > 0 || (this.strict && diff.unknown.length > 0)

    if (failing) {
      this.exitCode = 1
      return
    }

    this.logger.success('La base porte toutes les permissions déclarées.')
  }
}
