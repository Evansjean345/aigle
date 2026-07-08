import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#core/identity/user/domain/models/user'
import { memberHasPermission } from '#aiglebusiness/membership/application/authorization/permission_helpers'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

/**
 * Autorise la gestion des rôles d'une organisation. Contrairement au RBAC admin
 * (global), la porte est scopée à l'organisation passée en argument : l'utilisateur
 * doit y être membre avec la permission `roles:manage` (l'OWNER l'a d'office).
 */
export default class OrganisationRolePolicy extends BasePolicy {
  manage(user: User, organisationId: string): Promise<boolean> {
    return memberHasPermission(user.usersUid, organisationId, BUSINESS_PERMISSION.rolesManage)
  }
}
