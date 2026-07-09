import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import {
  type AppName,
  appAbility,
  APP_ABILITY_PREFIX,
} from '#core/identity/authentication/domain/enums/app_name'

/**
 * Cloisonne l'accès par produit : n'autorise que les tokens **stampés de l'app
 * attendue** (`app:<name>` en ability). À poser APRÈS `auth()` sur les groupes de
 * routes d'un produit.
 *
 * Sémantique (décision #4) : bonne app → `next()` ; **autre** app → 403 (le token
 * appartient à l'autre produit) ; **aucun** stamp `app:*` → 401 (token legacy →
 * re-login).
 */
export default class RequireAppMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { app: AppName }) {
    const token = ctx.auth?.user?.currentAccessToken
    const abilities: string[] = token?.abilities ?? []
    const stamped = abilities.filter((ability) => ability.startsWith(APP_ABILITY_PREFIX))

    if (stamped.length === 0) {
      // Token sans marquage d'app (émis avant le cloisonnement) → re-login.
      throw new Exception('Session obsolète, veuillez vous reconnecter', {
        status: 401,
        code: 'E_APP_STAMP_MISSING',
      })
    }

    if (!stamped.includes(appAbility(options.app))) {
      // Token d'un autre produit → accès interdit à ce produit.
      throw new Exception("Ce token n'est pas autorisé pour cette application", {
        status: 403,
        code: 'E_WRONG_APP',
      })
    }

    return next()
  }
}
