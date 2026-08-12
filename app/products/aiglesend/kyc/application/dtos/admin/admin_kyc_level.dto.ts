/**
 * Vues du back-office pour les paliers de vérification.
 *
 * Façonnent la réponse HTTP servie par `aiglesend` : le core rend un `Result`, le produit décide de
 * ce qu'il expose.
 */
import { type KycLevelResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_level.dto'

/** Qui agit, depuis où — ce que la piste d'audit retient d'un geste back-office. */
export interface AdminAuditContext {
  actorId: string
  actorType: string
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
}

/**
 * Montants ajustables d'un palier.
 *
 * Ni `segment` ni `level` : le couple identifie le palier et porte sa signification en code. Un
 * montant `null` signifie illimité.
 */
export class UpdateKycLevelDto {
  declare singleLimit?: number | null
  declare dailyLimit?: number | null
  declare monthlyLimit?: number | null
  declare balanceLimit?: number | null
}

/** Palier tel que le back-office le consulte. Un plafond `null` signifie illimité. */
export class KycLevelResponseDto {
  declare id: number
  declare segment: string
  declare level: number
  /** Ce que le palier autorise. Nul pour un couple qu'aucune règle ne prévoit. */
  declare title: string | null
  /** Comment un compte atteint ce palier. */
  declare reachedBy: string | null
  declare singleLimit: number | null
  declare dailyLimit: number | null
  declare monthlyLimit: number | null
  declare balanceLimit: number | null
  declare createdAt: string
  declare updatedAt: string

  /**
   * Construit la réponse depuis le palier projeté par le service.
   *
   * @param {KycLevelResult} level - Palier projeté.
   * @returns {KycLevelResponseDto} La réponse destinée au back-office.
   */
  static fromResult(level: KycLevelResult): KycLevelResponseDto {
    const dto = new KycLevelResponseDto()

    dto.id = level.id
    dto.segment = level.segment
    dto.level = level.level
    dto.title = level.title
    dto.reachedBy = level.reachedBy
    dto.singleLimit = level.singleLimit
    dto.dailyLimit = level.dailyLimit
    dto.monthlyLimit = level.monthlyLimit
    dto.balanceLimit = level.balanceLimit
    dto.createdAt = level.createdAt
    dto.updatedAt = level.updatedAt

    return dto
  }
}
