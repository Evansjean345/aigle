import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'

export interface AuthenticatedProfileResponseDto {
  accountNumber: string
  id: string
  firstname: string
  lastname: string
  phone: string
  accountType: string
  pictureUrl: string | null
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  kycLevel: KycLevelState
  kycStatus: 'pending' | 'approved' | 'rejected'
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
