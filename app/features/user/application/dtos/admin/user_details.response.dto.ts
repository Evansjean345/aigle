import { UserKycStatus, UserStatus } from '#features/user/domain/enum'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import { DateTime } from 'luxon'

export interface AdminUserDeviceResponseDto {
  id: string
  userId: string
  fingerprintHash: string
  deviceUid: string
  platform?: string
  brand?: string
  model?: string
  osVersion?: string
  appVersion?: string
  isEmulator: boolean
  isRooted: boolean
  ipFirstSeen?: string
  ipLastSeen?: string
  status: string
  lastSeenAt?: DateTime
  createdAt: DateTime
}

export interface AdminUserDetailsResponseDto {
  usersUid: string
  firstname: string
  lastname: string
  fullname: string
  phone: string
  email: string | null
  birthday: Date
  accountNumber: string
  accountType: string
  country: {
    name: string
    flag: string
    phoneCode: string
  }
  profilePic: string | null
  status: UserStatus
  createdAt: DateTime
  updatedAt: DateTime | null
  kyc: {
    level: number
    status: UserKycStatus
    documentType: KycDocumentType | null
    documentStatus: KycDocumentStatus | null
  }
  devices: AdminUserDeviceResponseDto[]
}
