import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#core/identity/user/domain/models/user'
import { memberHasPermission } from '#aiglebusiness/membership/application/authorization/permission_helpers'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

/**
 * Autorise la gestion des membres d'une organisation. Porte scopée à l'org passée
 * en argument : l'utilisateur doit y être membre actif avec `members:manage`
 * (l'OWNER l'a d'office).
 */
export default class OrganisationMemberPolicy extends BasePolicy {
  manage(user: User, organisationId: string): Promise<boolean> {
    return memberHasPermission(user.usersUid, organisationId, BUSINESS_PERMISSION.membersManage)
  }
}
