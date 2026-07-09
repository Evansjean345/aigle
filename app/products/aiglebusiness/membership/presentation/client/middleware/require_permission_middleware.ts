import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'
import type User from '#core/identity/user/domain/models/user'
import { AuditResult } from '#core/audit/domain/enums'
import { memberHasPermission } from '#aiglebusiness/membership/application/authorization/permission_helpers'
import { businessTraceContext, emitBusinessAudit } from '#aiglebusiness/shared/business_audit'

/**
 * Enforcement RBAC business (Lot D). Autorise l'accès à une route scopée
 * `organisations/:organisationId` si l'utilisateur authentifié est **membre actif**
 * de l'organisation et détient la permission requise. L'OWNER passe d'office
 * (bypass dans `memberHasPermission`).
 *
 * Vérification **live** (jamais gravée dans le token) : un changement de rôle prend
 * effet immédiatement, sans re-login. À poser APRÈS `auth()` + `requireApp()`.
 */
export default class RequirePermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { permission: string }) {
    const user = ctx.auth?.user as User | undefined
    const organisationId = ctx.params.organisationId as string | undefined

    if (!user || !organisationId) {
      throw new Exception('Contexte d’autorisation invalide', {
        status: 500,
        code: 'E_AUTHORIZATION_CONTEXT',
      })
    }

    const allowed = await memberHasPermission(user.usersUid, organisationId, options.permission)

    if (!allowed) {
      emitBusinessAudit(businessTraceContext(ctx), {
        eventCategory: 'AUTHORIZATION',
        eventAction: 'PERMISSION_DENIED',
        actorId: user.usersUid,
        targetType: 'Organisation',
        targetId: organisationId,
        result: AuditResult.FAILURE,
        errorCode: 'E_FORBIDDEN_ORG_PERMISSION',
        metadata: {
          permission: options.permission,
          method: ctx.request.method(),
          path: ctx.request.url(),
        },
      })

      throw new Exception("Vous n'avez pas la permission requise pour cette action", {
        status: 403,
        code: 'E_FORBIDDEN_ORG_PERMISSION',
      })
    }

    return next()
  }
}
