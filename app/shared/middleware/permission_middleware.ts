import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Admin from '#core/team/domain/models/admin'

export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, requiredPermissions: string[]) {
    const user = ctx.auth.user

    // Si pas d'utilisateur ou pas un admin, on laisse le AuthMiddleware gérer ou on rejette
    if (!user || !(user instanceof Admin)) {
      return ctx.response.unauthorized({ message: 'Accès non autorisé' })
    }

    // Charger le rôle et les permissions
    await user.load('role', (query) => {
      query.preload('permissions')
    })

    const userPermissions = user.role.permissions.map((p) => p.slug)

    // Le super_admin a tous les droits
    if (user.role.slug === 'root') {
      return next()
    }

    // Vérifier si l'utilisateur a au moins une des permissions requises
    const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p))

    if (!hasPermission) {
      return ctx.response.forbidden({
        message: "Vous n'avez pas les permissions nécessaires pour effectuer cette action",
      })
    }

    return next()
  }
}
