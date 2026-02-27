import { UserKycStatus, UserStatus } from '#features/user/domain/enum'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import { DateTime } from 'luxon'

export interface AdminUserListItemResponseDto {
  usersUid: string
  fullname: string
  phone: string
  country: {
    name: string
    flag: string
    phoneCode: string
  }
  profilePic: string | null
  status: UserStatus
  createdAt: DateTime<boolean>
  transactionVolume: {
    monthly_limit: number
    monthly: number
  }
  kyc: {
    level: number
    status: UserKycStatus
    documentType: KycDocumentType | null
    documentStatus: KycDocumentStatus | null
  }
  wallet: {
    balance: number
    currency?: string
  }
}

export interface PaginatedAdminUsersResponseDto {
  data: AdminUserListItemResponseDto[]
  meta: {
    total: number
    currentPage: number
    firstPage: number
    lastPage: number
    perPage: number
  }
}

export type AdminUsersListResponseDto = PaginatedAdminUsersResponseDto
