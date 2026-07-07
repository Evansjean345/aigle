import { type GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export class VerifyAccountRequestDto {
  declare phone: string
  declare otp: string
  declare country_id: number
  declare deviceInfo?: {
    fingerprintHash: string | null
    deviceUid: string | null
    platform: string | null
    appVersion: string | null
    osVersion: string | null
  }
  declare geoLocation?: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  static fromPayload(
    payload: any,
    deviceInfo?: any,
    geoLocation?: any,
    context?: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null }
  ): VerifyAccountRequestDto {
    const dto = new VerifyAccountRequestDto()
    dto.phone = payload.phone
    dto.otp = payload.otp
    dto.country_id = payload.country_id
    dto.deviceInfo = deviceInfo
    dto.geoLocation = geoLocation
    dto.ipAddress = context?.ipAddress ?? geoLocation?.ip ?? null
    dto.userAgent = context?.userAgent ?? null
    dto.requestId = context?.requestId ?? null
    return dto
  }
}
