import { inject } from '@adonisjs/core'
import User from '#core/user/domain/models/user'
import LogoutException from '#core/authentication/domain/exceptions/logout_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

export type LogoutContext = {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

@inject()
export default class LogoutUseCase {
  /**
   * Logs out the authenticated user by deleting their active access token and emitting an audit event.
   *
   * @param {any} authenticatedUser - The authenticated user object containing user information and current access token details.
   * @param {LogoutContext} [context={}] - Optional context object containing logout-related metadata, such as IP address, user agent, and request ID.
   * @return {Promise<boolean>} A promise that resolves to `true` if the logout operation is successful.
   * @throws {LogoutException} If an error occurs during the logout process.
   */
  async execute(authenticatedUser: any, context: LogoutContext = {}): Promise<boolean> {
    try {
      await User.accessTokens.delete(
        authenticatedUser as User,
        authenticatedUser.currentAccessToken.identifier
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_LOGOUT',
          actorId: String(authenticatedUser.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(authenticatedUser.id),
          result: AuditResult.SUCCESS,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        })
        .catch(() => {})

      return true
    } catch (error) {
      throw new LogoutException()
    }
  }
}
