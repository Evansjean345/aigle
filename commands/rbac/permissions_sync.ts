import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { PermissionCatalogDiff } from '#core/team/application/services/permission_catalog_diff_service'
import db from '@adonisjs/lucid/services/db'
import Permission from '#core/team/domain/models/permission'
import PermissionCatalogDiffService from '#core/team/application/services/permission_catalog_diff_service'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'

export default class PermissionsSync extends BaseCommand {
  static commandName = 'permissions:sync'
  static description = 'Aligne la table des permissions sur le catalogue déclaré en code'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: "N'écrit rien : affiche ce que la synchronisation ferait",
    default: false,
  })
  declare dryRun: boolean

  /**
   * Insère les permissions du catalogue absentes de la base et met à jour les libellés modifiés.
   *
   * Ne supprime jamais : les slugs présents en base et absents du catalogue sont seulement
   * signalés, leur sort relevant d'une décision humaine.
   *
   * @return {Promise<void>} Résout quand la synchronisation est écrite, ou après l'aperçu.
   */
  async run(): Promise<void> {
    const diffService = await this.app.container.make(PermissionCatalogDiffService)
    const diff = await diffService.compare(ADMIN_PERMISSION_CATALOG)

    this.report(diff)

    if (this.dryRun) {
      this.logger.info('Aperçu seul : aucune écriture.')
      return
    }

    if (diff.missing.length === 0 && diff.outdated.length === 0) {
      this.logger.success('La base est déjà alignée sur le catalogue.')
      return
    }

    await db.transaction(async (trx) => {
      await Permission.updateOrCreateMany(
        'slug',
        [...diff.missing, ...diff.outdated].map((definition) => ({
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
        })),
        { client: trx }
      )
    })

    this.logger.success(
      `${diff.missing.length} permission(s) créée(s), ${diff.outdated.length} mise(s) à jour.`
    )
  }

  /**
   * Affiche le détail de ce que la synchronisation va faire ou vient de faire.
   *
   * @param {PermissionCatalogDiff} diff - L'écart entre le catalogue et la base.
   */
  private report(diff: PermissionCatalogDiff): void {
    this.logger.info(`Catalogue : ${ADMIN_PERMISSION_CATALOG.length} permission(s) déclarée(s).`)

    for (const definition of diff.missing) {
      this.logger.log(`  + ${definition.slug} — ${definition.name}`)
    }

    for (const definition of diff.outdated) {
      this.logger.log(`  ~ ${definition.slug} — libellé mis à jour`)
    }

    if (diff.unknown.length > 0) {
      this.logger.warning(
        `${diff.unknown.length} permission(s) en base hors catalogue — conservée(s), à examiner :`
      )

      for (const permission of diff.unknown) {
        this.logger.log(`  ? ${permission.slug} — ${permission.name}`)
      }
    }
  }
}
