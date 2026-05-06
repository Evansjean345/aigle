import { type Token } from '#features/authentication/application/use_cases/admin/admin_login_use_case'
import type Admin from '#features/team/domain/models/admin'

export interface AdminLoginRequestDto {
  email: string
  password: string
}

export class AdminLoginChallengeDto {
  readonly requiresOtp = true as const
  declare email: string
  declare message: string

  static build(email: string): AdminLoginChallengeDto {
    const dto = new AdminLoginChallengeDto()
    dto.email = email
    dto.message = 'Un code de vérification a été envoyé à votre adresse email.'
    return dto
  }
}

export type AdminLoginResult = AdminLoginChallengeDto | AdminLoginResponseDto

export class AdminLoginResponseDto {
  declare access_token: Token
  declare refresh_token: Token
  declare admin: {
    id: number
    firstname: string
    lastname: string
    email: string
    role: {
      id: number
      slug: string
      name: string
      permissions: string[]
    }
  }

  static fromAdmin(
    admin: Admin,
    accessToken: Token,
    refreshToken: Token
  ): AdminLoginResponseDto {
    const dto = new AdminLoginResponseDto()
    dto.access_token = accessToken
    dto.refresh_token = refreshToken
    dto.admin = {
      id: admin.id,
      firstname: admin.firstname,
      lastname: admin.lastname,
      email: admin.email,
      role: {
        id: admin.role.id,
        slug: admin.role.slug,
        name: admin.role.name,
        permissions: admin.role.permissions.map((p) => p.slug),
      },
    }
    return dto
  }
}

export interface AdminRefreshTokenRequestDto {
  refresh_token: string
}

export interface AdminRefreshTokenResponseDto {
  access_token: Token
  refresh_token: Token
}

export const toAdminRefreshTokenResponse = (
  accessToken: Token,
  refreshToken: Token
): AdminRefreshTokenResponseDto => ({ access_token: accessToken, refresh_token: refreshToken })
