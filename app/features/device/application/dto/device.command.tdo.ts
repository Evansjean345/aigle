export interface DeviceCommandDTO {
  fingerprintHash: string
  deviceUid: string
  platform?: string
  brand?: string
  model?: string
  osVersion?: string
  appVersion?: string
  isEmulator: boolean
  isRooted: boolean
  ipFirstSeen?: string
  ipLastSeen?: string
  pushToken?: string | null
}
