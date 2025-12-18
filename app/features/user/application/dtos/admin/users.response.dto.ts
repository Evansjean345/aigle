import { UserKycStatus, UserStatus } from '#features/user/domain/enum'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import { DateTime } from 'luxon'

export interface AdminUserListItemResponseDto {
  usersUid: string
  fullname: string
  phone: string
  country: string | null
  accountType: string
  status: UserStatus
  createdAt: DateTime<boolean>

  kyc: {
    level: number | null
    status: UserKycStatus | null
    documentType: KycDocumentType | null
    documentStatus: KycDocumentStatus | null
    nextAction: string | null
  }

  wallet: {
    balance: number | null
    currency: string | null
    balanceLimit: number | null
  }
}

export type AdminUsersListResponseDto = AdminUserListItemResponseDto[]
