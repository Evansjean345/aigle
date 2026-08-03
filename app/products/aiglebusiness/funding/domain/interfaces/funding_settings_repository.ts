import type FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'

/**
 * Port de persistance des réglages du réapprovisionnement.
 */
export default abstract class FundingSettingsRepository {
  /**
   * Charge les réglages.
   *
   * @returns {Promise<FundingSettings | null>} Les réglages, ou `null` s'ils ne sont pas configurés.
   */
  abstract find(): Promise<FundingSettings | null>

  /**
   * Enregistre le seuil de double validation.
   *
   * Crée la ligne de réglages si elle n'existe pas encore.
   *
   * @param {number} threshold - Nouveau seuil.
   * @param {number} adminId - Gestionnaire à l'origine de la modification.
   * @returns {Promise<FundingSettings>} Les réglages enregistrés.
   */
  abstract saveThreshold(threshold: number, adminId: number): Promise<FundingSettings>
}
