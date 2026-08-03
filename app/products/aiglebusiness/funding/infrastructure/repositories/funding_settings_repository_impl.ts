import FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'
import type FundingSettingsRepository from '#aiglebusiness/funding/domain/interfaces/funding_settings_repository'

/** Persistance Lucid des réglages du réapprovisionnement. */
export default class FundingSettingsRepositoryImpl implements FundingSettingsRepository {
  /**
   * Charge les réglages.
   *
   * @returns {Promise<FundingSettings | null>} Les réglages, ou `null` s'ils ne sont pas configurés.
   */
  async find(): Promise<FundingSettings | null> {
    return FundingSettings.query().orderBy('id', 'asc').first()
  }

  /**
   * Enregistre le seuil de double validation.
   *
   * @param {number} threshold - Nouveau seuil.
   * @param {number} adminId - Gestionnaire à l'origine de la modification.
   * @returns {Promise<FundingSettings>} Les réglages enregistrés.
   */
  async saveThreshold(threshold: number, adminId: number): Promise<FundingSettings> {
    const existing = await this.find()

    if (existing) {
      existing.doubleApprovalThreshold = threshold
      existing.updatedByAdminId = adminId
      return existing.save()
    }

    const settings = new FundingSettings()
    settings.doubleApprovalThreshold = threshold
    settings.updatedByAdminId = adminId
    return settings.save()
  }
}
