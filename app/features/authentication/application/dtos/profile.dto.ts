import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'
import { UserKycStatus, UserStatus } from '#features/user/domain/enum'

export interface AuthenticatedProfileResponseDto {
  accountNumber: string
  id: string
  firstname: string
  lastname: string
  phone: string
  accountType: string
  pictureUrl: string | null
  status: UserStatus
  kycLevel: KycLevelState
  kycStatus: UserKycStatus
  country: Country
}

interface Country {
  id: number
  name: string
  code: string
  flag: string
}

export interface AuthenticatedProfileAndTokenResponseDto {
  user: AuthenticatedProfileResponseDto
  token: string
  type: 'Bearer'
}
