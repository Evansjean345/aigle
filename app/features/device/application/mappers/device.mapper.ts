import { DeviceRequestDTO, DeviceResponseDTO } from '#features/device/application/dto/device.tdo'
import { DeviceCommandDTO } from '#features/device/application/dto/device.command.tdo'
import Device from '#features/device/domain/models/device'

/**
 * Convert DeviceRequestDTO to DeviceCommandDTO
 * @param deviceRequestDto
 */
export const toDeviceCommand = async (
  deviceRequestDto: DeviceRequestDTO
): Promise<DeviceCommandDTO> => {
  return {
    fingerprintHash: deviceRequestDto.fingerprint_hash,
    deviceUid: deviceRequestDto.device_uid,
    platform: deviceRequestDto.platform,
    brand: deviceRequestDto.brand,
    model: deviceRequestDto.model,
    osVersion: deviceRequestDto.os_version,
    appVersion: deviceRequestDto.app_version,
    isEmulator: deviceRequestDto.is_emulator,
    isRooted: deviceRequestDto.is_rooted,
    ipFirstSeen: deviceRequestDto.ip_first_seen,
    ipLastSeen: deviceRequestDto.ip_last_seen,
  }
}

/**
 * Convert Device model to DeviceResponseDTO
 * @param device
 */
export const toDeviceResponse = (device: Device): DeviceResponseDTO => {
  return {
    last_seen: device.lastSeenAt?.toISO() ?? undefined,
    status: device.status,
    app_version: device.appVersion,
    model: device.model,
    platform: device.platform,
    device_uid: device.deviceUid,
    device_fingerprint: device.fingerprintHash,
    is_primary: device.isPrimary,
    id: device.id,
  }
}
