export interface DeviceRequestDTO {
  android_version?: string
  app_version?: string
  device_name?: string
  ios_version?: string
  platform?: string
  platform_version?: string
  token: string
}

export interface DeviceResponseDTO {
  id: number
}
