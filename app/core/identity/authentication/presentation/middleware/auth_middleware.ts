import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { UserStatus } from '#core/identity/user/domain/enum'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import '#shared/authentication/authenticated_actor'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })

    const user = ctx.auth.user
    if (user && user.status === UserStatus.BLOCKED) {
      throw new AccountBlockedException()
    }

    // Enrichit le contexte avec l'acteur authentifié réduit (contrat transverse), UNE fois au bord :
    // les controllers le lisent sans connaître le model User. Seul un User porte usersUid/countryId
    // (les routes admin utilisent Admin → authActor reste undefined, comme attendu).
    if (user && 'usersUid' in user) {
      ctx.authActor = {
        id: (user as { id: number }).id,
        usersUid: (user as { usersUid: string }).usersUid,
        countryId: (user as { countryId: number }).countryId,
      }
    }

    return next()
  }
}
