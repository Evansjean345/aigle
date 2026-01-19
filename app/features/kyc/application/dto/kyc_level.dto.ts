import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'

export interface CreateKycLevelDto {
  level: KycLevelState
  singleLimit: number
  dailyLimit: number
  monthlyLimit: number
  balanceLimit: number
  isActive?: boolean
}

export interface UpdateKycLevelDto {
  level?: KycLevelState
  singleLimit?: number
  dailyLimit?: number
  monthlyLimit?: number
  balanceLimit?: number
  isActive?: boolean
}

export interface KycLevelResponseDto {
  id: number
  level: number
  singleLimit: number
  dailyLimit: number
  monthlyLimit: number
  balanceLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
