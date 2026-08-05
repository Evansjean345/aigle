import { type GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import type UserDevice from '#core/identity/device/domain/models/user_device'
import { type DeviceIdentity } from '#core/identity/device/domain/enums/device_identity'

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
  /**
   * Solidité de l'empreinte, telle que déclarée sur le fil. Absent des clients antérieurs.
   *
   * Typé sur les valeurs de l'énumération plutôt que sur l'énumération : c'est une chaîne validée,
   * qui ne devient une valeur du domaine qu'en franchissant `DeviceCommandDTO`.
   */
  declare identity?: `${DeviceIdentity}`
  /** Clé matérielle, commune aux apps d'un même téléphone quand la plateforme le permet. */
  declare hardware_key?: string
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
    dto.identity = payload.identity ?? undefined
    dto.hardware_key = payload.hardware_key ?? undefined
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
  declare id: string
  declare device_id: string
  declare last_seen?: string
  /** App dont relève la liaison : un même appareil en porte une par app. */
  declare app: string
  declare status: string
  declare app_version?: string
  declare platform?: string
  declare model?: string
  declare device_uid: string
  declare is_primary: boolean
  declare device_fingerprint: string
  declare linked_at?: string
  declare is_vpn: boolean
  declare last_country_code?: string
  declare first_country_code?: string

  /**
   * Converts UserDevice (with a preloaded device) to DeviceResponseDTO
   */
  static fromUserDevice(userDevice: UserDevice): DeviceResponseDTO {
    const response = new DeviceResponseDTO()
    response.id = userDevice.id
    response.device_id = userDevice.deviceId
    response.last_seen = userDevice.lastSeenAt?.toISO() ?? undefined
    response.app = userDevice.app
    response.status = userDevice.status
    response.is_primary = userDevice.isPrimary
    response.is_vpn = userDevice.isVpn
    response.linked_at = userDevice.linkedAt?.toISO() ?? undefined
    response.first_country_code = userDevice?.firstCountryCode
    response.last_country_code = userDevice?.lastCountryCode

    // La liaison porte la version de SON app ; le matériel ne retient que la dernière enregistrée.
    response.app_version = userDevice.appVersion ?? undefined

    if (userDevice.device) {
      response.app_version = response.app_version ?? userDevice.device.appVersion
      response.model = userDevice.device.model
      response.platform = userDevice.device.platform
      response.device_uid = userDevice.device.deviceUid
      response.device_fingerprint = userDevice.device.fingerprintHash
    }

    return response
  }
}
