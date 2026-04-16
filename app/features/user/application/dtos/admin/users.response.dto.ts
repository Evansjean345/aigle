import { UserKycStatus, UserStatus } from '#features/user/domain/enum'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import { DateTime } from 'luxon'
import type User from '#features/user/domain/models/user'

export class AdminUserListItemResponseDto {
  declare usersUid: string
  declare fullname: string
  declare phone: string
  declare country: {
    name: string
    flag: string
    phoneCode: string
  }
  declare profilePic: string | null
  declare status: UserStatus
  declare createdAt: DateTime<boolean>
  declare transactionVolume: {
    monthly_limit: number
    monthly: number
  }
  declare kyc: {
    level: number
    status: UserKycStatus
    documentType: KycDocumentType | null
    documentStatus: KycDocumentStatus | null
  }
  declare wallet: {
    balance: number
    currency?: string
  }

  static fromUser(
    user: User,
    options?: { monthlyVolume: number }
  ): AdminUserListItemResponseDto {
    const dto = new AdminUserListItemResponseDto()
    dto.usersUid = user.usersUid
    dto.fullname = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
    dto.phone = user.phone
    dto.country = {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    }
    dto.status = user.status
    dto.createdAt = user.createdAt
    dto.profilePic = user.kycDocument?.selfieUrl || null
    dto.transactionVolume = {
      monthly_limit: user.keyLevel?.monthlyLimit || 0,
      monthly: options?.monthlyVolume ?? 0,
    }
    dto.kyc = {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
      documentType: user.kycDocument?.documentType,
      documentStatus: user.kycDocument?.status,
    }
    dto.wallet = {
      balance: user.wallet?.balance || 0,
      currency: user.wallet?.currencySymbol || '',
    }
    return dto
  }
}

export class PaginatedAdminUsersResponseDto {
  declare data: AdminUserListItemResponseDto[]
  declare meta: {
    total: number
    currentPage: number
    firstPage: number
    lastPage: number
    perPage: number
  }
}

export type AdminUsersListResponseDto = PaginatedAdminUsersResponseDto
