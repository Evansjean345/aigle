import { BaseSeeder } from '@adonisjs/lucid/seeders'
import FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'

/**
 * Seuil initial de double validation des réapprovisionnements.
 *
 * Le seuil doit exister : sans lui, aucune validation n'est possible, le service refusant de
 * supposer qu'un dossier n'a pas besoin d'un second valideur.
 */
const SEUIL_INITIAL = 1_000_000

export default class extends BaseSeeder {
  async run() {
    // Ne pas écraser un seuil déjà réglé par un administrateur.
    const existing = await FundingSettings.query().first()

    if (!existing) {
      const settings = new FundingSettings()
      settings.doubleApprovalThreshold = SEUIL_INITIAL
      settings.updatedByAdminId = null
      await settings.save()
    }
  }
}
