import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import Admin from '#core/team/domain/models/admin'

export default class PermissionMiddleware {
  /**
   * Refuse la requête si l'administrateur ne détient aucune des permissions requises.
   *
   * Aucun rôle n'est dispensé de la vérification. Un administrateur sans rôle reçoit un 403, comme
   * celui dont le rôle ne porte pas la permission.
   *
   * @param {HttpContext} ctx - Le contexte de la requête.
   * @param {NextFn} next - La suite de la chaîne de middlewares.
   * @param {PermissionDefinition[]} requiredPermissions - Les permissions acceptées, dont une seule suffit.
   * @return {Promise<void>} La réponse d'échec, ou la suite de la chaîne.
   */
  async handle(
    ctx: HttpContext,
    next: NextFn,
    requiredPermissions: PermissionDefinition[]
  ): Promise<void> {
    const user = ctx.auth.user

    if (!user || !(user instanceof Admin)) {
      return ctx.response.unauthorized({ message: 'Accès non autorisé' })
    }

    await user.load('role', (query) => {
      query.preload('permissions')
    })

    const held = new Set(user.role?.permissions?.map((p) => p.slug) ?? [])
    const hasPermission = requiredPermissions.some((p) => held.has(p.slug))

    if (!hasPermission) {
      return ctx.response.forbidden({
        message: "Vous n'avez pas les permissions nécessaires pour effectuer cette action",
      })
    }

    return next()
  }
}
