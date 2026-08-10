import { type KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import type KycLevel from '#core/identity/kyc/domain/models/kyc_level'

/**
 * Contrats de service des niveaux KYC.
 *
 * Ce que le service reçoit et ce qu'il rend, sans modèle ORM : les consommateurs vivent hors du
 * contexte identity.
 */

// ── Command (input service) ─────────────────────────────────────────

export interface CreateKycLevelCommand {
  level: KycLevelState
  singleLimit: number
  dailyLimit: number
  monthlyLimit: number
  balanceLimit: number
  isActive?: boolean
  isArchived?: boolean
}

export interface UpdateKycLevelCommand {
  level?: KycLevelState
  singleLimit?: number
  dailyLimit?: number
  monthlyLimit?: number
  balanceLimit?: number
  isActive?: boolean
  isArchived?: boolean
}

// ── Result (output service) ─────────────────────────────────────────

/**
 * Niveau KYC et ses plafonds, projeté hors du contexte identity.
 *
 * Un plafond `null` signifie illimité.
 */
export interface KycLevelResult {
  id: number
  level: number
  singleLimit: number | null
  dailyLimit: number | null
  monthlyLimit: number | null
  balanceLimit: number | null
  isActive: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export const toKycLevelResult = (kycLevel: KycLevel): KycLevelResult => ({
  id: kycLevel.id,
  level: kycLevel.level,
  singleLimit: kycLevel.singleLimit,
  dailyLimit: kycLevel.dailyLimit,
  monthlyLimit: kycLevel.monthlyLimit,
  balanceLimit: kycLevel.balanceLimit,
  isActive: kycLevel.isActive,
  isArchived: kycLevel.isArchived,
  createdAt: kycLevel.createdAt?.toISO() || '',
  updatedAt: kycLevel.updatedAt?.toISO() || '',
})

// ── Vues admin (présentation back-office) ───────────────────────────

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
