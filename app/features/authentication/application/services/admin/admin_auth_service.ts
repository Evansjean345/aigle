import Admin from '#features/team/domain/models/admin'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import { Exception } from '@adonisjs/core/exceptions'
import { Token } from '#features/authentication/application/use_cases/admin/admin_login_use_case'
import AdminNotFoundException from '#features/team/infrastructure/exceptions/admin_not_found_exception'
import { DateTime } from 'luxon'

/**
 * Provides authentication services for admin users, including token generation
 * and token formatting.
 */
export default class AdminAuthService {
  /**
   * Performs the complete login process for an admin user.
   *
   * @param {string} email - The email address of the admin user.
   * @param {string} password - The password associated with the admin user's account.
   * @param {string} requestIp - The IP address of the requester.
   * @return {Promise<{ admin: Admin; tokens: { access: AccessToken; refresh: AccessToken } }>}
   * @throws {AdminNotFoundException} If the credentials are invalid.
   */
  async login(
    email: string,
    password: string,
    requestIp: string
  ): Promise<{ admin: Admin; tokens: { access: AccessToken; refresh: AccessToken } }> {
    const admin = await this.verifyCredentials(email, password)
    const tokens = await this.generateTokens(admin)

    admin.lastLoginAt = DateTime.now()
    admin.lastLoginIp = requestIp

    await admin.save()
    return { admin, tokens }
  }

  /**
   * Verifies the credentials of an admin user based on the provided email and password.
   *
   * @param {string} email - The email address of the admin user.
   * @param {string} password - The password associated with the admin user's account.
   * @return {Promise<Admin>} A promise that resolves to the Admin object if the credentials are valid.
   * @throws {AdminNotFoundException} If the credentials are invalid.
   */
  async verifyCredentials(email: string, password: string): Promise<Admin> {
    try {
      const admin = await Admin.verifyCredentials(email, password)
      await admin.load('role', (query) => {
        query.preload('permissions')
      })
      return admin
    } catch (error) {
      throw new AdminNotFoundException('Identifiants invalides')
    }
  }

  /**
   * Generates access and refresh tokens for the provided admin user.
   *
   * @param {Admin} user - The admin user for whom the tokens are to be generated.
   * @return {Promise<{ access: AccessToken; refresh: AccessToken }>} A promise that resolves to an object containing the access token and refresh token.
   */
  async generateTokens(user: Admin): Promise<{ access: AccessToken; refresh: AccessToken }> {
    const [access, refresh] = await Promise.all([
      Admin.accessTokens.create(user, ['*']),
      Admin.refreshToken.create(user, ['ability']),
    ])
    return { access, refresh }
  }

  /**
   * Formats an access token into a standardized token object.
   *
   * @param {AccessToken} token - The access token object that contains the value, type, and expiration details.
   * @return {Token} A formatted token object that includes its type, value, and expiration date as an ISO string.
   * @throws {Exception} If the token value is missing.
   */
  formatToken(token: AccessToken): Token {
    if (!token.value) {
      throw new Exception('Token value is missing')
    }

    return {
      type: 'bearer',
      value: token.value.release(),
      expiresAt: token.expiresAt?.toISOString(),
    }
  }
}
