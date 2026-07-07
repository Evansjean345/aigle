import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { UserStatus } from '#core/identity/user/domain/enum'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'

export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)

    const user = ctx.auth.user

    if (user && user.status === UserStatus.BLOCKED) {
      throw new AccountBlockedException()
    }

    return next()
  }
}
