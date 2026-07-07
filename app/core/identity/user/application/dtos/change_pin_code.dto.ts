import type User from '#core/identity/user/domain/models/user'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface ChangePinCodeDTO {
  user: User
  oldPincode: string
  newPincode: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}
