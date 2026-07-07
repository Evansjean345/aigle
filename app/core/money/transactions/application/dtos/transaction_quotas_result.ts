import { type KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'

export interface TransactionQuotasResult {
  daily: {
    consumed: number
    limit: number
    remaining: number
  }
  monthly: {
    consumed: number
    limit: number
    remaining: number
  }
  wallet: {
    currentBalance: number
    limit: number
    remainingCapacity: number
  }
  singleTransaction: {
    limit: number
  }
  kycLevel: KycLevelState
}
