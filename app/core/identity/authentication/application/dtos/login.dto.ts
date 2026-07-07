import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import { DeviceRequestDTO } from '#core/identity/device/application/dto/device.dto'

export class LoginRequestDto {
  declare phone: string
  declare pincode: string
  declare country_id: number
  declare device?: DeviceRequestDTO
  declare geoLocation?: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  /**
   * Creates a LoginRequestDto from payload and GeoIp location
   */
  static fromPayload(
    payload: any,
    geoIp: GeoIpLocation,
    context?: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null }
  ): LoginRequestDto {
    const dto = new LoginRequestDto()
    dto.phone = payload.phone
    dto.pincode = payload.codepin
    dto.country_id = payload.country_id
    dto.device = DeviceRequestDTO.from(payload.devicePayload, geoIp)
    dto.geoLocation = geoIp
    dto.ipAddress = context?.ipAddress ?? geoIp?.ip ?? null
    dto.userAgent = context?.userAgent ?? null
    dto.requestId = context?.requestId ?? null
    return dto
  }
}

export interface LoginResult {
  message: string
}
