import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { UserStatus } from '#core/identity/user/domain/enum'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import '#shared/authentication/authenticated_actor'

/**
 * Middleware d'authentification : vérifie le token (access tokens AdonisJS), refuse les non
 * authentifiés / comptes bloqués, puis injecte l'acteur réduit dans `ctx.authActor`.
 *
 * POURQUOI DANS identity (et pas shared, contrairement à device/geoip) : ce middleware s'EXÉCUTE
 * partout (transversal d'exécution) MAIS il CONNAÎT le contexte identity — il lit `user.status`
 * (model User), lève une exception d'auth. Le critère de placement n'est pas « peuple-t-il ctx »
 * (device/geoip le font aussi) mais « dépend-il d'une feature » : device/geoip lisent des headers/IP
 * bruts (agnostiques → shared) ; auth connaît User (→ identity, le contexte propriétaire). Le mettre
 * dans shared ré-introduirait la violation shared→feature nettoyée au durcissement #5.
 *
 * Il PRODUIT le contrat transverse `ctx.authActor` (défini dans shared, sans dépendance) : c'est
 * l'ACL d'auth d'identity qui, au bord, réduit `ctx.auth.user` (model) en vue neutre. À l'extraction
 * micro-services, l'API gateway jouerait ce rôle (claims du token) sans appel inter-service.
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
