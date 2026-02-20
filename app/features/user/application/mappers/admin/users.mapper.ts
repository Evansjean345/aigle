import User from '#features/user/domain/models/user'
import { AdminUserListItemResponseDto } from '#features/user/application/dtos/admin/users.response.dto'
import { AdminUserDetailsResponseDto } from '#features/user/application/dtos/admin/user_details.response.dto'
import { UserSearchResponseDto } from '#features/user/application/dtos/admin/user_search.response.dto'

export function mapUserToAdminListItemDto(user: User): AdminUserListItemResponseDto {
  return {
    usersUid: user.usersUid,
    fullname: [user.firstname, user.lastname].filter(Boolean).join(' ').trim(),
    phone: user.phone,
    country: {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    },
    status: user.status,
    createdAt: user.createdAt,
    profilePic: user.kycDocument?.selfieUrl || null,
    transactionVolume: {
      monthly_limit: user.keyLevel?.monthlyLimit || 0,
      monthly: user.transactionVolumes?.monthly || 0,
    },
    kyc: {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
      documentType: user.kycDocument?.documentType,
      documentStatus: user.kycDocument?.status,
    },
    wallet: {
      balance: user.wallet?.balance || 0,
      currency: user.wallet?.currencySymbol || '',
    },
  }
}

/**
 * Maps User and Devices models to AdminUserDetailsResponseDto.
 *
 * @param {User} user
 * @return {AdminUserDetailsResponseDto}
 */
export function mapUserToAdminDetailsDto(user: User): AdminUserDetailsResponseDto {
  return {
    usersUid: user.usersUid,
    firstname: user.firstname,
    lastname: user.lastname,
    fullname: [user.firstname, user.lastname].filter(Boolean).join(' ').trim(),
    phone: user.phone,
    email: user.email,
    birthday: user.birthday,
    accountNumber: user.accountNumber,
    accountType: user.accountType,
    country: {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    },
    profilePic: user.kycDocument?.selfieUrl || null,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    kyc: {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
      documentType: user.kycDocument?.documentType || null,
      documentStatus: user.kycDocument?.status || null,
    },
    devices: user.devices.map((device) => ({
      id: device.id,
      userId: device.userId,
      fingerprintHash: device.fingerprintHash,
      deviceUid: device.deviceUid,
      platform: device.platform,
      brand: device.brand,
      model: device.model,
      isPrimary: device.isPrimary,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
      isEmulator: device.isEmulator,
      isRooted: device.isRooted,
      ipFirstSeen: device.ipFirstSeen,
      ipLastSeen: device.ipLastSeen,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    })),
  }
}

/**
 * Maps a User object to a UserSearchResponseDto object.
 *
 * @param {User} user - The user object containing user details.
 * @return {UserSearchResponseDto} A DTO containing mapped user search details.
 */
export function mapUserToSearchDto(user: User): UserSearchResponseDto {
  return {
    usersUid: user.usersUid,
    fullname: [user.firstname, user.lastname].filter(Boolean).join(' ').trim(),
    phone: user.phone,
    profilePic: user.kycDocument?.selfieUrl || null,
    country: {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    },
    kyc: {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
    },
    status: user.status,
  }
}
