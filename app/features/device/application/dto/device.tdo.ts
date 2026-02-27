export interface DeviceRequestDTO {
  fingerprint_hash: string
  device_uid: string
  platform?: string
  brand?: string
  model?: string
  os_version?: string
  app_version?: string
  is_emulator: boolean
  is_rooted: boolean
  ip_first_seen?: string
  ip_last_seen?: string
  push_token?: string | null
}

export interface DeviceResponseDTO {
  last_seen?: string
  status: string
  app_version?: string
  platform?: string
  model?: string
  device_uid: string
  is_primary: boolean
  id: string
  device_fingerprint: string
}
