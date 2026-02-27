import { DeviceRequestDTO } from '#features/device/application/dto/device.tdo'

export interface LoginRequestDto {
  phone: string
  pincode: string
  country_id: number
  // Device info
  device?: DeviceRequestDTO
}

export interface LoginResult {
  message: string
}
