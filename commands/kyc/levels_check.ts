import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import KycLevelCatalogDiffService from '#core/identity/kyc/application/services/kyc_level_catalog_diff_service'
import { KYC_LEVEL_CATALOG } from '#core/identity/kyc/domain/kyc_level_catalog'

export default class KycLevelsCheck extends BaseCommand {
  static commandName = 'kyc:levels:check'
  static description = 'Vérifie que la base porte les paliers déclarés en code, sans rien écrire'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Échouer aussi sur les paliers présents en base et absents du catalogue',
    default: false,
  })
  declare strict: boolean

  /**
   * Constate l'écart entre le catalogue et la grille.
   *
   * Sort en échec dès qu'un palier déclaré manque en base : un compte qui s'y trouve ne résout
   * aucun plafond. Un palier en base hors catalogue ne fait pas échouer, sauf en mode strict.
   *
   * @returns {Promise<void>} Résout après le constat ; le code de sortie porte le verdict.
   */
  async run(): Promise<void> {
    const diffService = await this.app.container.make(KycLevelCatalogDiffService)
    const diff = await diffService.compare(KYC_LEVEL_CATALOG)

    this.logger.info(`Catalogue : ${KYC_LEVEL_CATALOG.length} palier(s) déclaré(s).`)

    if (diff.missing.length > 0) {
      this.logger.error(
        `${diff.missing.length} palier(s) déclaré(s) en code et absent(s) de la base — un compte qui s'y trouve ne résout aucun plafond :`
      )

      for (const definition of diff.missing) {
        this.logger.log(`  ! ${definition.segment}:${definition.level} — ${definition.title}`)
      }
    }

    if (diff.unknown.length > 0) {
      this.logger.warning(`${diff.unknown.length} palier(s) en base hors catalogue :`)

      for (const level of diff.unknown) {
        this.logger.log(`  ? ${level.segment}:${level.level}`)
      }
    }

    const failing = diff.missing.length > 0 || (this.strict && diff.unknown.length > 0)

    if (failing) {
      this.exitCode = 1
      return
    }

    this.logger.success('La base porte tous les paliers déclarés.')
  }
}
