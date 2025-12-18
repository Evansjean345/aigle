import User from '#features/user/domain/models/user'
import { AdminUserListItemResponseDto } from '#features/user/application/dtos/admin/users.response.dto'

export function mapUserToAdminListItemDto(user: User): AdminUserListItemResponseDto {
  const wallet = (user as any).wallet?.$attributes
  const keyLevel = (user as any).keyLevel?.$attributes
  const kycDocument = (user as any).kycDocument?.$attributes
  const country = (user as any).country?.$attributes

  return {
    usersUid: user.usersUid,
    fullname: [user.firstname, user.lastname].filter(Boolean).join(' ').trim(),
    phone: user.phone,
    country: country?.code ?? null,
    accountType: user.accountType,
    status: user.status,
    createdAt: user.createdAt,
    kyc: {
      level: keyLevel?.level ?? (user as any).kycLevel ?? null,
      status: (user as any).kycStatus ?? null,
      documentType: kycDocument?.documentType ?? null,
      documentStatus: kycDocument?.status ?? null,
      nextAction: kycDocument?.nextAction ?? null,
    },
    wallet: {
      balance: wallet?.balance ?? null,
      currency: wallet?.currencySymbol ?? null,
      balanceLimit: keyLevel?.balanceLimit ?? null,
    },
  }
}
