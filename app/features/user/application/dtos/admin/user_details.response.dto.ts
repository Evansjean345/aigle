import { type UserKycStatus, type UserStatus } from '#features/user/domain/enum'
import { type DateTime } from 'luxon'
import { type KycDocumentStatus, type KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import { type ProviderType } from '#features/catalogs/domain/models/provider'
import type User from '#features/user/domain/models/user'

export class AdminUserDeviceResponseDto {
  declare id: string
  declare deviceId: string
  declare status: string
  declare isPrimary: boolean
  declare ipFirstSeen?: string
  declare ipLastSeen?: string
  declare linkedAt?: DateTime
  declare lastSeenAt?: DateTime
  declare createdAt: DateTime
  declare firstCountryCode: string | null
  declare lastCountryCode: string | null
  declare device: {
    fingerprintHash: string
    deviceUid: string
    platform?: string
    brand?: string
    model?: string
    osVersion?: string
    appVersion?: string
    isEmulator: boolean
    isRooted: boolean
  } | null
}

export class AdminUserDebitPhone {
  declare id: number
  declare phone: string
  declare label: string | null
  declare isVerified: boolean
  declare createdAt: DateTime
  declare verifiedAt: DateTime | null
  declare provider: {
    id: number
    type: ProviderType
    code: string
    logo?: string | null
  }
}

export class AdminUserDetailsResponseDto {
  declare usersUid: string
  declare firstname: string
  declare lastname: string
  declare fullname: string
  declare phone: string
  declare email: string | null
  declare birthday: Date
  declare accountNumber: string
  declare accountType: string
  declare country: {
    name: string
    flag: string
    phoneCode: string
  }
  declare profilePic: string | null
  declare status: UserStatus
  declare createdAt: DateTime
  declare updatedAt: DateTime | null
  declare kyc: {
    status: UserKycStatus
    level: number
    documentType: KycDocumentType | null
    documentStatus: KycDocumentStatus | null
  }
  declare devices: AdminUserDeviceResponseDto[]
  declare debitPhones: AdminUserDebitPhone[]

  static fromUser(user: User): AdminUserDetailsResponseDto {
    const dto = new AdminUserDetailsResponseDto()
    dto.usersUid = user.usersUid
    dto.firstname = user.firstname
    dto.lastname = user.lastname
    dto.fullname = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
    dto.phone = user.phone
    dto.email = user.email
    dto.birthday = user.birthday
    dto.accountNumber = user.accountNumber
    dto.accountType = user.accountType
    dto.country = {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    }
    dto.profilePic = user.kycDocument?.selfieUrl || null
    dto.status = user.status
    dto.createdAt = user.createdAt
    dto.updatedAt = user.updatedAt
    dto.kyc = {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
      documentType: user.kycDocument?.documentType || null,
      documentStatus: user.kycDocument?.status || null,
    }
    dto.devices = user.userDevices.map((ud) => {
      const deviceDto = new AdminUserDeviceResponseDto()
      deviceDto.id = ud.id
      deviceDto.deviceId = ud.deviceId
      deviceDto.status = ud.status
      deviceDto.isPrimary = ud.isPrimary
      deviceDto.ipFirstSeen = ud.ipFirstSeen
      deviceDto.ipLastSeen = ud.ipLastSeen
      deviceDto.linkedAt = ud.linkedAt
      deviceDto.lastSeenAt = ud.lastSeenAt
      deviceDto.createdAt = ud.createdAt
      deviceDto.firstCountryCode = ud.firstCountryCode ?? null
      deviceDto.lastCountryCode = ud.lastCountryCode ?? null
      deviceDto.device = ud.device
        ? {
            fingerprintHash: ud.device.fingerprintHash,
            deviceUid: ud.device.deviceUid,
            platform: ud.device.platform,
            brand: ud.device.brand,
            model: ud.device.model,
            osVersion: ud.device.osVersion,
            appVersion: ud.device.appVersion,
            isEmulator: ud.device.isEmulator,
            isRooted: ud.device.isRooted,
          }
        : null
      return deviceDto
    })
    dto.debitPhones = user.debitPhones.map((phoneNumber) => {
      const phoneDto = new AdminUserDebitPhone()
      phoneDto.id = phoneNumber.id
      phoneDto.phone = phoneNumber.phone
      phoneDto.label = phoneNumber.label
      phoneDto.isVerified = phoneNumber.isVerified
      phoneDto.createdAt = phoneNumber.createdAt
      phoneDto.verifiedAt = phoneNumber.verifiedAt
      phoneDto.provider = {
        id: phoneNumber.provider.id,
        code: phoneNumber.provider.code,
        logo: phoneNumber.provider.logo,
        type: phoneNumber.provider.type,
      }
      return phoneDto
    })
    return dto
  }
}
