import { GeoIpLocation } from '#shared/infrastructure/geoip_service'
import Device from '#features/device/domain/models/device'

export class DeviceRequestDTO {
  declare fingerprint_hash: string
  declare device_uid: string
  declare platform?: string
  declare brand?: string
  declare model?: string
  declare os_version?: string
  declare app_version?: string
  declare is_emulator: boolean
  declare is_rooted: boolean
  declare ip_first_seen?: string
  declare ip_last_seen?: string
  declare push_token?: string | null
  declare last_country_code?: string
  declare first_country_code?: string
  declare is_vpn?: boolean

  /**
   * Creates a request DTO from payload and location
   */
  static from(payload: Record<string, any>, geoIp: GeoIpLocation): DeviceRequestDTO {
    const dto = new DeviceRequestDTO()
    dto.fingerprint_hash = payload.fingerprint_hash
    dto.device_uid = payload.device_uid
    dto.brand = payload.brand ?? undefined
    dto.model = payload.model ?? undefined
    dto.app_version = payload.app_version ?? undefined
    dto.is_rooted = Boolean(payload.is_rooted)
    dto.is_emulator = Boolean(payload.is_emulator)
    dto.platform = payload.platform ?? undefined
    dto.os_version = payload.os_version ?? undefined
    dto.ip_first_seen = geoIp.ip ?? undefined
    dto.first_country_code = geoIp.countryCode ?? undefined
    dto.ip_last_seen = geoIp.ip ?? undefined
    dto.last_country_code = geoIp.countryCode ?? undefined
    dto.is_vpn = geoIp.isVpn ?? false
    return dto
  }
}

export class DeviceResponseDTO {
  declare last_seen?: string
  declare status: string
  declare app_version?: string
  declare platform?: string
  declare model?: string
  declare device_uid: string
  declare is_primary: boolean
  declare id: string
  declare device_fingerprint: string

  /**
   * Converts Device model to DeviceResponseDTO
   */
  static fromModel(device: Device): DeviceResponseDTO {
    const response = new DeviceResponseDTO()
    response.last_seen = device.lastSeenAt?.toISO() ?? undefined
    response.status = device.status
    response.app_version = device.appVersion
    response.model = device.model
    response.platform = device.platform
    response.device_uid = device.deviceUid
    response.device_fingerprint = device.fingerprintHash
    response.is_primary = device.isPrimary
    response.id = device.id
    return response
  }
}
