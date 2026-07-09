import { type UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'

// ── RequestDto (input use cases) ────────────────────────────────────

/** Étape 1 : phone + PIN → déclenche l'OTP. */
export interface BusinessLoginRequestDto {
  phone: string
  pincode: string
}

/** Étape 2 : phone + OTP → émet le token. `sessionName` libelle la session (Lot 3). */
export interface BusinessVerifyLoginRequestDto {
  phone: string
  otp: string
  sessionName?: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Profil minimal renvoyé après authentification (pas de données sensibles). */
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

/** Réponse de l'étape 2 : token stampé `app:aiglebusiness` + profil. */
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
