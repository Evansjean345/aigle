import { DeviceRequestDTO } from '#features/device/application/dto/device.tdo'
import { RegisterValidatorType } from '#features/authentication/presentation/mobile/validators/auth_validator'
import { GeoIpLocation } from '#shared/infrastructure/geoip_service'

export class RegisterRequestDto {
  declare phone: string
  declare firstname: string
  declare lastname: string
  declare email?: string
  declare pincode: string
  declare country_id: number
  declare deviceInfoPayload?: DeviceRequestDTO

  /**
   * Creates a RegisterRequestDto from validator payload and GeoIp location
   */
  static fromPayload(payload: RegisterValidatorType, geoIp: GeoIpLocation): RegisterRequestDto {
    const dto = new RegisterRequestDto()
    dto.firstname = payload.firstname
    dto.lastname = payload.lastname
    dto.email = payload.email ?? undefined
    dto.phone = payload.phone
    dto.country_id = Number(payload.country_id)
    dto.pincode = payload.pincode
    dto.deviceInfoPayload = DeviceRequestDTO.from(payload.deviceInfo, geoIp)
    return dto
  }
}

export interface RegisterResponseDto {
  message: string
  phone: string
}
