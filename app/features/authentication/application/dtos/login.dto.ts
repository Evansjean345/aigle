import { GeoIpLocation } from '#shared/infrastructure/geoip_service'
import { DeviceRequestDTO } from '#features/device/application/dto/device.tdo'

export class LoginRequestDto {
  declare phone: string
  declare pincode: string
  declare country_id: number
  declare device?: DeviceRequestDTO

  /**
   * Creates a LoginRequestDto from payload and GeoIp location
   */
  static fromPayload(payload: any, geoIp: GeoIpLocation): LoginRequestDto {
    const dto = new LoginRequestDto()
    dto.phone = payload.phone
    dto.pincode = payload.codepin
    dto.country_id = payload.country_id
    dto.device = DeviceRequestDTO.from(payload.devicePayload, geoIp)
    return dto
  }
}

export interface LoginResult {
  message: string
}
