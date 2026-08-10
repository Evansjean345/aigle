/**
 * Vues du back-office pour les paliers de vérification.
 *
 * Façonnent la réponse HTTP servie par `aiglesend` : le core rend un `Result`, le produit décide de
 * ce qu'il expose.
 */
import { type KycLevelResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_level.dto'
import { type KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'

export class CreateKycLevelDto {
  declare level: KycLevelState
  declare singleLimit: number
  declare dailyLimit: number
  declare monthlyLimit: number
  declare balanceLimit: number
  declare isActive?: boolean
  declare isArchived?: boolean
}

export class UpdateKycLevelDto {
  declare level?: KycLevelState
  declare singleLimit?: number
  declare dailyLimit?: number
  declare monthlyLimit?: number
  declare balanceLimit?: number
  declare isActive?: boolean
  declare isArchived?: boolean
}

export class KycLevelResponseDto {
  declare id: number
  declare level: number
  declare singleLimit: number
  declare dailyLimit: number
  declare monthlyLimit: number
  declare balanceLimit: number
  declare isActive: boolean
  declare isArchived: boolean
  declare createdAt: string
  declare updatedAt: string

  /**
   * Construit la réponse depuis le niveau projeté par le service.
   *
   * @param {KycLevelResult} level - Niveau projeté.
   * @returns {KycLevelResponseDto} La réponse destinée au back-office.
   */
  static fromResult(level: KycLevelResult): KycLevelResponseDto {
    const dto = new KycLevelResponseDto()
    dto.id = level.id
    dto.level = level.level
    dto.singleLimit = level.singleLimit
    dto.dailyLimit = level.dailyLimit
    dto.monthlyLimit = level.monthlyLimit
    dto.balanceLimit = level.balanceLimit
    dto.isActive = level.isActive
    dto.isArchived = level.isArchived
    dto.createdAt = level.createdAt
    dto.updatedAt = level.updatedAt
    return dto
  }
}
