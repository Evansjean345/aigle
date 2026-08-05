import type Device from '#core/identity/device/domain/models/device'
import type UserDevice from '#core/identity/device/domain/models/user_device'

/**
 * DTO pour un device dans la liste admin (avec compteurs enrichis).
 */
export class AdminDeviceListItemDto {
  declare id: string
  declare fingerprintHash: string
  declare deviceUid: string
  declare platform?: string
  declare brand?: string
  declare model?: string
  declare osVersion?: string
  declare appVersion?: string
  declare isEmulator: boolean
  declare isRooted: boolean
  declare createdAt: string
  declare accountCount: number
  declare lastActivity: string | null

  static fromDevice(device: Device): AdminDeviceListItemDto {
    const dto = new AdminDeviceListItemDto()
    dto.id = device.id
    dto.fingerprintHash = device.fingerprintHash
    dto.deviceUid = device.deviceUid
    dto.platform = device.platform
    dto.brand = device.brand
    dto.model = device.model
    dto.osVersion = device.osVersion
    dto.appVersion = device.appVersion
    dto.isEmulator = device.isEmulator
    dto.isRooted = device.isRooted
    dto.createdAt = device.createdAt.toISO()!
    dto.accountCount = Number(device.$extras.account_count ?? 0)
    dto.lastActivity = device.$extras.last_activity ?? null
    return dto
  }
}

/**
 * DTO pour une association user↔device dans la timeline.
 */
export class AdminDeviceAssociationDto {
  declare id: string
  declare userId: string
  declare phone: string
  declare fullname: string
  declare userStatus: string
  /** App dont relève la liaison : un même appareil en porte une par app. */
  declare app: string
  declare status: string
  declare isPrimary: boolean
  declare ipFirstSeen?: string
  declare ipLastSeen?: string
  declare firstCountryCode?: string
  declare lastCountryCode?: string
  declare isVpn: boolean
  declare linkedAt: string | null
  declare lastSeenAt: string | null
  declare unlinkedAt: string | null

  static fromUserDevice(ud: UserDevice): AdminDeviceAssociationDto {
    const user = ud.user ?? null
    const dto = new AdminDeviceAssociationDto()
    dto.id = ud.id
    dto.userId = ud.userId
    dto.phone = user?.phone ?? ''
    dto.fullname = user ? [user.firstname, user.lastname].filter(Boolean).join(' ').trim() : ''
    dto.userStatus = user?.status ?? ''
    dto.app = ud.app
    dto.status = ud.status
    dto.isPrimary = ud.isPrimary
    dto.ipFirstSeen = ud.ipFirstSeen
    dto.ipLastSeen = ud.ipLastSeen
    dto.firstCountryCode = ud.firstCountryCode
    dto.lastCountryCode = ud.lastCountryCode
    dto.isVpn = ud.isVpn
    dto.linkedAt = ud.linkedAt?.toISO() ?? null
    dto.lastSeenAt = ud.lastSeenAt?.toISO() ?? null
    dto.unlinkedAt = ud.unlinkedAt?.toISO() ?? null
    return dto
  }
}

/**
 * DTO pour le detail complet d'un device.
 */
export class AdminDeviceDetailDto {
  declare id: string
  declare fingerprintHash: string
  declare deviceUid: string
  declare platform?: string
  declare brand?: string
  declare model?: string
  declare osVersion?: string
  declare appVersion?: string
  declare isEmulator: boolean
  declare isRooted: boolean
  declare createdAt: string
  declare counters: {
    activeAccounts: number
    historicalAccounts: number
    total: number
  }
  declare flags: {
    hasVpn: boolean
    countryCodes: string[]
  }
  declare associations: AdminDeviceAssociationDto[]

  static fromDevice(device: Device, associations: UserDevice[]): AdminDeviceDetailDto {
    const activeAssociations = associations.filter((a) => !a.unlinkedAt)
    const historicalAssociations = associations.filter((a) => a.unlinkedAt)

    const countryCodes = [
      ...new Set(
        associations
          .flatMap((a) => [a.firstCountryCode, a.lastCountryCode])
          .filter(Boolean) as string[]
      ),
    ]

    const hasVpn = associations.some((a) => a.isVpn)

    const dto = new AdminDeviceDetailDto()
    dto.id = device.id
    dto.fingerprintHash = device.fingerprintHash
    dto.deviceUid = device.deviceUid
    dto.platform = device.platform
    dto.brand = device.brand
    dto.model = device.model
    dto.osVersion = device.osVersion
    dto.appVersion = device.appVersion
    dto.isEmulator = device.isEmulator
    dto.isRooted = device.isRooted
    dto.createdAt = device.createdAt.toISO()!
    dto.counters = {
      activeAccounts: activeAssociations.length,
      historicalAccounts: historicalAssociations.length,
      total: associations.length,
    }
    dto.flags = { hasVpn, countryCodes }
    dto.associations = associations.map(AdminDeviceAssociationDto.fromUserDevice)
    return dto
  }
}

/**
 * DTO pour un compte associe a un device (endpoint /accounts).
 */
export class AdminDeviceAccountDto {
  declare userId: string
  declare phone: string
  declare fullname: string
  declare userStatus: string
  /** App dont relève la liaison : un même appareil en porte une par app. */
  declare app: string
  declare associationStatus: string
  declare isPrimary: boolean
  declare ipFirstSeen?: string
  declare ipLastSeen?: string
  declare firstCountryCode?: string
  declare lastCountryCode?: string
  declare isVpn: boolean
  declare linkedAt: string | null
  declare lastSeenAt: string | null
  declare unlinkedAt: string | null

  static fromUserDevice(ud: UserDevice): AdminDeviceAccountDto {
    const user = ud.user ?? null
    const dto = new AdminDeviceAccountDto()
    dto.userId = ud.userId
    dto.phone = user?.phone ?? ''
    dto.fullname = user ? [user.firstname, user.lastname].filter(Boolean).join(' ').trim() : ''
    dto.userStatus = user?.status ?? ''
    dto.app = ud.app
    dto.associationStatus = ud.status
    dto.isPrimary = ud.isPrimary
    dto.ipFirstSeen = ud.ipFirstSeen
    dto.ipLastSeen = ud.ipLastSeen
    dto.firstCountryCode = ud.firstCountryCode
    dto.lastCountryCode = ud.lastCountryCode
    dto.isVpn = ud.isVpn
    dto.linkedAt = ud.linkedAt?.toISO() ?? null
    dto.lastSeenAt = ud.lastSeenAt?.toISO() ?? null
    dto.unlinkedAt = ud.unlinkedAt?.toISO() ?? null
    return dto
  }
}

/**
 * Filtres pour la liste admin devices.
 */
export class AdminDeviceFilters {
  declare minAccounts?: number
  declare isEmulator?: boolean
  declare isRooted?: boolean
  declare hasVpn?: boolean
  declare platform?: string
  declare search?: string
  declare sortBy: string
  declare order: string
  declare page: number
  declare perPage: number
}
