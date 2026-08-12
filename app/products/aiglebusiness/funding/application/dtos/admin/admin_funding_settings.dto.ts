import type FundingSettings from '#aiglebusiness/funding/domain/models/funding_settings'

/**
 * Contrats admin des réglages du réapprovisionnement.
 *
 * Aucun canal marchand : le seuil gouverne un contrôle interne, il ne sort pas du back-office.
 */

// ── Response (output HTTP) ──────────────────────────────────────────

/**
 * Réglages tels que les voit le back-office.
 *
 * L'auteur de la modification n'en fait pas partie : le journal d'audit le trace déjà, et le
 * republier ici en ferait une seconde version à tenir à jour. Reste la date, qui dit depuis quand
 * le seuil affiché s'applique.
 */
export class AdminFundingSettingsResponseDTO {
  declare doubleApprovalThreshold: number
  declare updatedAt: string | null

  /**
   * Construit la vue admin des réglages.
   *
   * @param {FundingSettings} settings - Réglages chargés depuis le repository.
   * @returns {AdminFundingSettingsResponseDTO} La vue destinée au back-office.
   */
  static fromSettings(settings: FundingSettings): AdminFundingSettingsResponseDTO {
    const dto = new AdminFundingSettingsResponseDTO()
    dto.doubleApprovalThreshold = Number(settings.doubleApprovalThreshold)
    dto.updatedAt = settings.updatedAt?.toISO() ?? null

    return dto
  }
}
