import Admin from '#core/team/domain/models/admin'
import { type AccessToken } from '@adonisjs/auth/access_tokens'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import { type Token } from '#core/authentication/application/use_cases/admin/admin_login_use_case'
import AdminNotFoundException from '#core/team/domain/exceptions/admin_not_found_exception'
import AdminAccountBlockedException from '#core/team/domain/exceptions/admin_account_blocked_exception'
import AdminTemporarilyBlockedException from '#core/team/domain/exceptions/admin_temporarily_blocked_exception'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import AdminAttemptGuard from '#core/authentication/application/services/admin/admin_attempt_guard'

/**
 * Provides authentication services for admin users, including token generation
 * and token formatting.
 */
@inject()
export default class AdminAuthService {
  constructor(private readonly attemptGuard: AdminAttemptGuard) {}

  /**
   * First leg of the 2FA login: validates credentials and account state, but
   * does NOT issue tokens. The caller is expected to dispatch an OTP and only
   * call `completeLoginAfterOtp` once the OTP is verified.
   *
   * @param {string} email - The email address of the admin user.
   * @param {string} password - The password associated with the admin user's account.
   * @param {string} requestIp - The IP address of the requester.
   * @return {Promise<Admin>} The verified admin (without tokens).
   * @throws {AdminNotFoundException} If the credentials are invalid.
   */
  async verifyCredentialsForChallenge(
    email: string,
    password: string,
    requestIp: string
  ): Promise<Admin> {
    try {
      await this.attemptGuard.assertNotBlocked(email)
      const admin = await this.verifyCredentials(email, password)

      await this.attemptGuard.assertAdminActive(admin)
      await this.attemptGuard.recordSuccess(email)

      return admin
    } catch (error) {
      const isBlockError =
        error instanceof AdminTemporarilyBlockedException ||
        error instanceof AdminAccountBlockedException

      if (error instanceof AdminNotFoundException) {
        await this.attemptGuard.recordFailure(email, requestIp)
      }

      const blockedCode =
        (error as AdminTemporarilyBlockedException | AdminAccountBlockedException)?.code ??
        'BLOCKED'
      const errorCode = isBlockError ? blockedCode : 'INVALID_CREDENTIALS'

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'LOGIN_FAILED',
          actorId: email,
          actorType: 'Admin',
          actorRole: null,
          initiatedByType: 'Admin',
          initiatedById: null,
          targetType: 'Member',
          targetId: null,
          result: AuditResult.FAILURE,
          ipAddress: requestIp,
          metadata: { email },
          errorCode,
          errorMessage: (error as Error)?.message ?? 'Login failed',
        })
        .catch(() => {})

      throw error
    }
  }

  /**
   * Second leg of the 2FA login: issues tokens, updates last-login metadata
   * and emits the LOGIN_SUCCESS audit event. To be called only after the OTP
   * has been verified.
   */
  async completeLoginAfterOtp(
    admin: Admin,
    requestIp: string
  ): Promise<{ access: AccessToken; refresh: AccessToken }> {
    const tokens = await this.generateTokens(admin)

    admin.lastLoginAt = DateTime.now()
    admin.lastLoginIp = requestIp
    await admin.save()

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'LOGIN_SUCCESS',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role?.name ?? null,
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress: requestIp,
        metadata: { ip: requestIp, mfa: 'email_otp' },
      })
      .catch(() => {})

    return tokens
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
