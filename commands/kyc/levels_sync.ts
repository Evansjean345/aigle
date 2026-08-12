import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { KycLevelCatalogDiffResult } from '#core/identity/kyc/application/dtos/kyc_level_catalog.dto'
import db from '@adonisjs/lucid/services/db'
import KycLevel from '#core/identity/kyc/domain/models/kyc_level'
import KycLevelCatalogDiffService from '#core/identity/kyc/application/services/kyc_level_catalog_diff_service'
import { KYC_LEVEL_CATALOG } from '#core/identity/kyc/domain/kyc_level_catalog'

export default class KycLevelsSync extends BaseCommand {
  static commandName = 'kyc:levels:sync'
  static description = 'Aligne la grille des plafonds sur le catalogue déclaré en code'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: "N'écrit rien : affiche ce que la synchronisation ferait",
    default: false,
  })
  declare dryRun: boolean

  /**
   * Insère les paliers du catalogue absents de la base, avec leurs montants de création.
   *
   * Ne met jamais à jour un palier existant, et ne supprime jamais : un palier présent en base et
   * absent du catalogue est seulement signalé.
   *
   * @returns {Promise<void>} Résout quand l'insertion est écrite, ou après l'aperçu.
   */
  async run(): Promise<void> {
    const diffService = await this.app.container.make(KycLevelCatalogDiffService)
    const diff = await diffService.compare(KYC_LEVEL_CATALOG)

    this.report(diff)

    if (this.dryRun) {
      this.logger.info('Aperçu seul : aucune écriture.')
      return
    }

    if (diff.missing.length === 0) {
      this.logger.success('La base porte tous les paliers déclarés.')
      return
    }

    await db.transaction(async (trx) => {
      await KycLevel.createMany(
        diff.missing.map((definition) => ({
          segment: definition.segment,
          level: definition.level,
          ...definition.defaults,
        })),
        { client: trx }
      )
    })

    this.logger.success(`${diff.missing.length} palier(s) créé(s).`)
  }

  /**
   * Affiche l'écart constaté.
   *
   * @param {KycLevelCatalogDiffResult} diff - Écart entre le catalogue et la grille.
   */
  private report(diff: KycLevelCatalogDiffResult): void {
    this.logger.info(`Catalogue : ${KYC_LEVEL_CATALOG.length} palier(s) déclaré(s).`)

    for (const definition of diff.missing) {
      this.logger.log(`  + ${definition.segment}:${definition.level} — ${definition.title}`)
    }

    if (diff.unknown.length > 0) {
      this.logger.warning(`${diff.unknown.length} palier(s) en base hors catalogue :`)

      for (const level of diff.unknown) {
        this.logger.log(`  ? ${level.segment}:${level.level}`)
      }
    }
  }
}
