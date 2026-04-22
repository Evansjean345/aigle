import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface OtpRequestDto {
  phone: string
  country_id: number
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

export interface OtpResponseDto {
  message: string
  sent: boolean
  waitTime?: number
}
