import { type DeviceRequestDTO } from '#core/identity/device/application/dto/device.dto'
import { type DeviceIdentity } from '#core/identity/device/domain/enums/device_identity'

export class DeviceCommandDTO {
  declare fingerprintHash: string
  declare deviceUid: string
  declare platform?: string
  declare brand?: string
  declare model?: string
  declare osVersion?: string
  declare appVersion?: string
  declare isEmulator: boolean
  declare isRooted: boolean
  declare identity?: DeviceIdentity
  declare ipFirstSeen?: string
  declare ipLastSeen?: string
  declare pushToken?: string | null
  declare firstCountryCode?: string
  declare lastCountryCode?: string
  declare isVpn?: boolean

  /**
   * Converts DeviceRequestDTO to DeviceCommandDTO
   */
  static fromRequest(request: DeviceRequestDTO): DeviceCommandDTO {
    const command = new DeviceCommandDTO()
    command.fingerprintHash = request.fingerprint_hash
    command.deviceUid = request.device_uid
    command.platform = request.platform
    command.brand = request.brand
    command.model = request.model
    command.osVersion = request.os_version
    command.appVersion = request.app_version
    command.isEmulator = request.is_emulator
    command.isRooted = request.is_rooted
    command.identity = request.identity as DeviceIdentity | undefined
    command.ipFirstSeen = request.ip_first_seen
    command.ipLastSeen = request.ip_last_seen
    command.firstCountryCode = request.first_country_code
    command.lastCountryCode = request.last_country_code
    command.isVpn = request.is_vpn
    return command
  }
}
