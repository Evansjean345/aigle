import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

/**
 * Vérifie si un user possède une permission DANS une organisation donnée.
 *
 * Scopé par org : le même user peut avoir des rôles différents selon l'org. Charge
 * son membre **ACTIF** (org + user) → rôle → permissions. Le rôle OWNER laisse tout
 * passer. Un non-membre, ou un membre PENDING/REMOVED, n'a aucune permission.
 * Équivalent org-scopé d'`adminHasPermission` (RBAC team).
 */
export async function memberHasPermission(
  userId: string,
  organisationId: string,
  perm: string | string[]
): Promise<boolean> {
  const member = await OrganisationMember.query()
    .where('organisation_id', organisationId)
    .where('user_id', userId)
    .where('status', MemberStatus.ACTIVE)
    .preload('role', (roleQuery) => roleQuery.preload('permissions'))
    .first()

  if (!member || !member.role) return false

  if (member.role.slug === OWNER_ROLE_SLUG) return true

  const slugs = member.role.permissions.map((p) => p.permissionSlug)

  if (Array.isArray(perm)) {
    return perm.some((p) => slugs.includes(p))
  }

  return slugs.includes(perm)
}
