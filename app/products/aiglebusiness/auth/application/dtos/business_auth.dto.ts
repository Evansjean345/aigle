import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'
import { type DeviceRequestDTO } from '#core/identity/device/application/dto/device.dto'
import { type ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'

// ── RequestDto (input use cases) ────────────────────────────────────

export interface BusinessLoginRequestDto {
  phone: string
  pincode: string
  /** Canal déclaré (mobile/web) : `mobile` → appareil requis ; `web` → appareil ignoré. */
  channel: ClientChannel
  /** Mobile business : présent → l'appareil est enregistré (PENDING) au PIN. */
  deviceInfo?: DeviceRequestDTO
}

export interface BusinessVerifyLoginRequestDto {
  phone: string
  otp: string
  sessionName?: string
  /** Canal déclaré (mobile/web) → stampé sur le token, expose la session. */
  channel: ClientChannel
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
