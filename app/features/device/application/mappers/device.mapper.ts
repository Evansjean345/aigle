import { DeviceRequestDTO } from '#mobile/device/dto/device.tdo'
import { DeviceCommandTdo } from '#mobile/device/dto/device.command.tdo'

/**
 * Convert DeviceRequestDTO to DeviceCommandTdo
 * @param deviceRequestDto
 */
export const toDeviceCommand = async (
  deviceRequestDto: DeviceRequestDTO
): Promise<DeviceCommandTdo> => {
  return {
    androidVersion: deviceRequestDto.android_version,
    appVersion: deviceRequestDto.app_version,
    deviceName: deviceRequestDto.device_name,
    iosVersion: deviceRequestDto.ios_version,
    platform: deviceRequestDto.platform,
    platformVersion: deviceRequestDto.platform_version,
    token: deviceRequestDto.token,
  }
}
