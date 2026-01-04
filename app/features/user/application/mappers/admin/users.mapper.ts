import User from '#features/user/domain/models/user'
import { AdminUserListItemResponseDto } from '#features/user/application/dtos/admin/users.response.dto'

export function mapUserToAdminListItemDto(user: User): AdminUserListItemResponseDto {
  return {
    usersUid: user.usersUid,
    fullname: [user.firstname, user.lastname].filter(Boolean).join(' ').trim(),
    phone: user.phone,
    country: {
      name: user.country.name,
      flag: user.country.flag,
      phoneCode: user.country.phoneCode,
    },
    status: user.status,
    createdAt: user.createdAt,
    profilePic: user.kycDocument?.selfieUrl || null,
    transactionVolume: {
      monthly_limit: user.keyLevel.monthlyLimit,
      monthly: user.transactionVolumes.monthly,
    },
    kyc: {
      level: user.keyLevel.level,
      status: user.kycStatus,
      documentType: user.kycDocument?.documentType,
      documentStatus: user.kycDocument?.status,
    },
    wallet: {
      balance: user.wallet.balance,
      currency: user.wallet.currencySymbol,
    },
  }
}
