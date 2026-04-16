import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

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

  static fromPayload(payload: any, deviceInfo?: any, geoLocation?: any): VerifyAccountRequestDto {
    const dto = new VerifyAccountRequestDto()
    dto.phone = payload.phone
    dto.otp = payload.otp
    dto.country_id = payload.country_id
    dto.deviceInfo = deviceInfo
    dto.geoLocation = geoLocation
    return dto
  }
}
