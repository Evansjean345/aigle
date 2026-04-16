import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'
import type KycLevel from '#features/kyc/domain/models/kyc_level'

export class CreateKycLevelDto {
  declare level: KycLevelState
  declare singleLimit: number
  declare dailyLimit: number
  declare monthlyLimit: number
  declare balanceLimit: number
  declare isActive?: boolean
}

export class UpdateKycLevelDto {
  declare level?: KycLevelState
  declare singleLimit?: number
  declare dailyLimit?: number
  declare monthlyLimit?: number
  declare balanceLimit?: number
  declare isActive?: boolean
}

export class KycLevelResponseDto {
  declare id: number
  declare level: number
  declare singleLimit: number
  declare dailyLimit: number
  declare monthlyLimit: number
  declare balanceLimit: number
  declare isActive: boolean
  declare createdAt: string
  declare updatedAt: string

  static fromKycLevel(kycLevel: KycLevel): KycLevelResponseDto {
    const dto = new KycLevelResponseDto()
    dto.id = kycLevel.id
    dto.level = kycLevel.level
    dto.singleLimit = kycLevel.singleLimit
    dto.dailyLimit = kycLevel.dailyLimit
    dto.monthlyLimit = kycLevel.monthlyLimit
    dto.balanceLimit = kycLevel.balanceLimit
    dto.isActive = kycLevel.isActive
    dto.createdAt = kycLevel.createdAt?.toISO() || ''
    dto.updatedAt = kycLevel.updatedAt?.toISO() || ''
    return dto
  }
}
