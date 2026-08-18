import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import { type DeviceRequestDTO } from '#core/identity/device/application/dtos/device.dto'

// ── RequestDto (input use cases) ────────────────────────────────────
// Le canal + le contexte de requête (IP/UA/requestId/géo) sont passés à part via
// `BusinessAuthTraceContext` (cf. business_auth_audit.ts).

export interface BusinessLoginRequestDto {
  phone: string
  pincode: string
  /** Mobile business : présent → l'appareil est enregistré (PENDING) au PIN. */
  deviceInfo?: DeviceRequestDTO
}

export interface BusinessVerifyLoginRequestDto {
  phone: string
  otp: string
  sessionName?: string
  /** Mobile business : fingerprint + uid (issus des HEADERS device) → truste l'appareil. */
  deviceFingerprint?: string
  deviceUid?: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class BusinessAuthProfileDTO {
  declare userId: string
  declare firstname: string | null
  declare lastname: string | null
  declare phone: string

  static from(user: UserLookupResult): BusinessAuthProfileDTO {
    const dto = new BusinessAuthProfileDTO()
    dto.userId = user.userId
    dto.firstname = user.firstname
    dto.lastname = user.lastname
    dto.phone = user.phone
    return dto
  }
}

export class BusinessAuthTokenDTO {
  declare token: string
  declare profile: BusinessAuthProfileDTO

  static from(token: string, user: UserLookupResult): BusinessAuthTokenDTO {
    const dto = new BusinessAuthTokenDTO()
    dto.token = token
    dto.profile = BusinessAuthProfileDTO.from(user)
    return dto
  }
}
