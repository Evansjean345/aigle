import Admin from '#features/team/domain/models/admin'
import {
  AdminLoginResponseDto,
  AdminRefreshTokenResponseDto,
} from '#features/authentication/application/dtos/admin/admin_login.dto'
import { Token } from '#features/authentication/application/use_cases/admin/admin_login_use_case'

/**
 * Transforms an admin entity and tokens into an AdminLoginResponseDto object.
 *
 * @param {Admin} admin - The admin entity containing administration details such as id, firstname, lastname, email, and role.
 * @param {Token} accessToken - The access token issued to the admin for authenticated interactions.
 * @param {Token} refreshToken - The refresh token issued for renewing the access token.
 * @returns {AdminLoginResponseDto} An object containing the access token, refresh token, and admin information.
 */
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

/**
 * Transforms access and refresh token information into an AdminRefreshTokenResponseDto object.
 *
 * @function toAdminRefreshTokenResponse
 * @param {Token} accessToken - The access token to be included in the response DTO.
 * @param {Token} refreshToken - The refresh token to be included in the response DTO.
 * @returns {AdminRefreshTokenResponseDto} An object containing the access and refresh tokens mapped to their respective fields.
 */
export const toAdminRefreshTokenResponse = (
  accessToken: Token,
  refreshToken: Token
): AdminRefreshTokenResponseDto => ({ access_token: accessToken, refresh_token: refreshToken })
