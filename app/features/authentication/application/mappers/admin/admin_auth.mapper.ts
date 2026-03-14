import Admin from '#features/team/domain/models/admin'
import {
  AdminLoginResponseDto,
  AdminRefreshTokenResponseDto,
} from '#features/authentication/application/dtos/admin/admin_login.dto'
import { Token } from '#features/authentication/application/use_cases/admin/admin_login_use_case'

export const toAdminLoginResponse = (
  admin: Admin,
  accessToken: Token,
  refreshToken: Token
): AdminLoginResponseDto => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  admin: {
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
  },
})

export const toAdminRefreshTokenResponse = (
  accessToken: Token,
  refreshToken: Token
): AdminRefreshTokenResponseDto => ({ access_token: accessToken, refresh_token: refreshToken })
