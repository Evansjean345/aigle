import { DeviceRequestDTO } from '#core/device/application/dto/device.dto'
import { type RegisterValidatorType } from '#core/authentication/presentation/mobile/validators/auth_validator'
import { type GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export class RegisterRequestDto {
  declare phone: string
  declare firstname: string
  declare lastname: string
  declare email?: string
  declare pincode: string
  declare country_id: number
  declare deviceInfoPayload?: DeviceRequestDTO
  declare geoLocation?: GeoIpLocation
  declare ipAddress?: string | null
  declare userAgent?: string | null
  declare requestId?: string | null

  /**
   * Creates a RegisterRequestDto from validator payload and GeoIp location
   */
  static fromPayload(
    payload: RegisterValidatorType,
    geoIp: GeoIpLocation,
    context?: { ipAddress?: string | null; userAgent?: string | null; requestId?: string | null }
  ): RegisterRequestDto {
    const dto = new RegisterRequestDto()
    dto.firstname = payload.firstname
    dto.lastname = payload.lastname
    dto.email = payload.email ?? undefined
    dto.phone = payload.phone
    dto.country_id = Number(payload.country_id)
    dto.pincode = payload.pincode
    dto.deviceInfoPayload = DeviceRequestDTO.from(payload.deviceInfo, geoIp)
    dto.geoLocation = geoIp
    dto.ipAddress = context?.ipAddress ?? geoIp?.ip ?? null
    dto.userAgent = context?.userAgent ?? null
    dto.requestId = context?.requestId ?? null
    return dto
  }
}

export interface RegisterResponseDto {
  message: string
  phone: string
}
