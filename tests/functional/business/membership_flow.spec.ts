import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import OrganisationRolePermission from '#aiglebusiness/membership/domain/models/organisation_role_permission'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'
import { allPermissionSlugs } from '#aiglebusiness/membership/domain/permissions.config'

/**
 * Caractérise le seeding RBAC (Lot A) à la création d'une organisation : le rôle
 * système OWNER (toutes les permissions du catalogue) + le membre OWNER (le
 * créateur), pour les deux types. Marchand comme entreprise : OWNER seul.
 */
async function createOrg(
  accountType: OrganisationAccountType,
  ownerUserId: string
): Promise<string> {
  const useCase = await app.container.make(CreateOrganisationUseCase)

  const org = await useCase.execute({
    ownerUserId,
    ownerKycStatus: UserKycStatus.VERIFIED,
    name: 'Org Test',
    accountType,
  })
  return org.organisationId
}

test.group('Business membership | seeding RBAC à la création', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('marchand : rôle OWNER (toutes permissions) + membre OWNER', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = await createOrg(OrganisationAccountType.MARCHAND, ownerUserId)

    // Un seul rôle : OWNER, is_system.
    const roles = await OrganisationRole.query().where('organisation_id', organisationId)
    assert.lengthOf(roles, 1)
    assert.equal(roles[0].slug, OWNER_ROLE_SLUG)
    assert.isTrue(roles[0].isSystem)

    // OWNER porte toutes les permissions du catalogue.
    const perms = await OrganisationRolePermission.query().where('role_id', roles[0].id)
    assert.sameMembers(
      perms.map((p) => p.permissionSlug),
      allPermissionSlugs()
    )

    // Un membre OWNER = le créateur, actif.
    const members = await OrganisationMember.query().where('organisation_id', organisationId)
    assert.lengthOf(members, 1)
    assert.equal(members[0].userId, ownerUserId)
    assert.equal(members[0].roleId, roles[0].id)
    assert.equal(members[0].status, MemberStatus.ACTIVE)
  })

  test('entreprise : même seeding (OWNER seul)', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = await createOrg(OrganisationAccountType.ENTERPRISE, ownerUserId)

    const roles = await OrganisationRole.query().where('organisation_id', organisationId)
    assert.lengthOf(roles, 1)
    assert.equal(roles[0].slug, OWNER_ROLE_SLUG)

    const members = await OrganisationMember.query().where('organisation_id', organisationId)
    assert.lengthOf(members, 1)
    assert.equal(members[0].userId, ownerUserId)
  })
})
