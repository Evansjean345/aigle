import { Token } from '#features/authentication/application/use_cases/admin/admin_login_use_case'

export interface AdminLoginRequestDto {
  email: string
  password: string
}

export interface AdminLoginResponseDto {
  access_token: Token
  refresh_token: Token
  admin: {
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
}

export interface AdminRefreshTokenRequestDto {
  refresh_token: string
}

export interface AdminRefreshTokenResponseDto {
  access_token: Token
  refresh_token: Token
}
