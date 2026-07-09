import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import User from '#core/identity/user/domain/models/user'
import { UserKycStatus, UserStatus } from '#core/identity/user/domain/enum'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import CreateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/create_role.use_case'
import UpdateRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/update_role.use_case'
import DeleteRoleUseCase from '#aiglebusiness/membership/application/use_cases/roles/delete_role.use_case'
import ListRolesUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_roles.use_case'
import ListPermissionsCatalogUseCase from '#aiglebusiness/membership/application/use_cases/roles/list_permissions_catalog.use_case'
import { memberHasPermission } from '#aiglebusiness/membership/application/authorization/permission_helpers'
import OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { OWNER_ROLE_SLUG } from '#aiglebusiness/membership/domain/system_roles'
import { BUSINESS_PERMISSIONS } from '#aiglebusiness/membership/domain/permissions.config'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Caractérise le RBAC éditable (Lot C) : CRUD des rôles d'organisation (validation
 * du catalogue, slug dérivé, garde rôle système, scope par org), le catalogue de
 * permissions, le helper `memberHasPermission`, et la porte Bouncer côté HTTP.
 */

async function createOrg(ownerUserId: string): Promise<string> {
  const useCase = await app.container.make(CreateOrganisationUseCase)
  const org = await useCase.execute({
    ownerUserId,
    ownerKycStatus: UserKycStatus.VERIFIED,
    name: 'Org Test',
    accountType: OrganisationAccountType.ENTERPRISE,
  })
  return org.organisationId
}

async function makeUser(): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Test'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  await user.save()
  return user
}

test.group('Business roles | use cases', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('catalogue : toutes les permissions du domaine, avec flag sensible', async ({ assert }) => {
    const useCase = await app.container.make(ListPermissionsCatalogUseCase)
    const catalogue = await useCase.execute()

    assert.lengthOf(catalogue, BUSINESS_PERMISSIONS.length)
    const membersManage = catalogue.find((p) => p.slug === 'members:manage')
    assert.isTrue(membersManage!.sensitive)
    const walletView = catalogue.find((p) => p.slug === 'wallet:view')
    assert.isFalse(walletView!.sensitive)
  })

  test('créer un rôle : slug dérivé du nom + permissions attachées', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)

    const role = await create.execute({
      organisationId,
      name: 'Comptable Senior',
      permissionSlugs: ['transactions:view', 'wallet:view'],
    })

    assert.equal(role.slug, 'comptable-senior')
    assert.isFalse(role.isSystem)
    assert.sameMembers(role.permissions, ['transactions:view', 'wallet:view'])

    const list = await app.container.make(ListRolesUseCase)
    const roles = await list.execute(organisationId)
    // OWNER (seedé) + le nouveau
    assert.lengthOf(roles, 2)
  })

  test('créer un rôle : permission hors catalogue → 400', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)

    await assert.rejects(
      () =>
        create.execute({
          organisationId,
          name: 'Bidon',
          permissionSlugs: ['transactions:view', 'foo:bar'],
        }),
      /Permission inconnue/
    )
  })

  test('créer un rôle : sans permission → refus', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)

    await assert.rejects(() =>
      create.execute({ organisationId, name: 'Vide', permissionSlugs: [] })
    )
  })

  test('créer un rôle : nom déjà pris → conflit', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)

    await create.execute({ organisationId, name: 'Caissier', permissionSlugs: ['wallet:view'] })
    await assert.rejects(() =>
      create.execute({ organisationId, name: 'Caissier', permissionSlugs: ['wallet:view'] })
    )
  })

  test('éditer un rôle : nom + remplacement des permissions', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const update = await app.container.make(UpdateRoleUseCase)

    const role = await create.execute({
      organisationId,
      name: 'Ops',
      permissionSlugs: ['wallet:view'],
    })

    const updated = await update.execute({
      organisationId,
      roleId: role.id,
      name: 'Ops Lead',
      permissionSlugs: ['wallet:view', 'transactions:view', 'provision:request'],
    })

    assert.equal(updated.name, 'Ops Lead')
    assert.equal(updated.slug, 'ops') // slug immuable
    assert.sameMembers(updated.permissions, [
      'wallet:view',
      'transactions:view',
      'provision:request',
    ])
  })

  test('éditer le rôle système OWNER → interdit', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const owner = await OrganisationRole.query()
      .where('organisation_id', organisationId)
      .where('slug', OWNER_ROLE_SLUG)
      .firstOrFail()
    const update = await app.container.make(UpdateRoleUseCase)

    await assert.rejects(() => update.execute({ organisationId, roleId: owner.id, name: 'Hacked' }))
  })

  test('supprimer un rôle personnalisé', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const del = await app.container.make(DeleteRoleUseCase)
    const list = await app.container.make(ListRolesUseCase)

    const role = await create.execute({
      organisationId,
      name: 'Temporaire',
      permissionSlugs: ['wallet:view'],
    })
    await del.execute(organisationId, role.id)

    const roles = await list.execute(organisationId)
    assert.isUndefined(roles.find((r) => r.id === role.id))
  })

  test('supprimer le rôle système OWNER → interdit', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const owner = await OrganisationRole.query()
      .where('organisation_id', organisationId)
      .where('slug', OWNER_ROLE_SLUG)
      .firstOrFail()
    const del = await app.container.make(DeleteRoleUseCase)

    await assert.rejects(() => del.execute(organisationId, owner.id))
  })

  test('rôle d’une autre organisation → introuvable (scope)', async ({ assert }) => {
    const orgA = await createOrg(randomUUID())
    const orgB = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const del = await app.container.make(DeleteRoleUseCase)

    const role = await create.execute({
      organisationId: orgA,
      name: 'Interne A',
      permissionSlugs: ['wallet:view'],
    })

    // orgB ne peut ni voir ni supprimer un rôle d'orgA
    await assert.rejects(() => del.execute(orgB, role.id))
  })
})

test.group('Business roles | memberHasPermission', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('membre OWNER → autorisé pour toute permission (bypass)', async ({ assert }) => {
    const ownerUserId = randomUUID()
    const organisationId = await createOrg(ownerUserId)

    assert.isTrue(await memberHasPermission(ownerUserId, organisationId, 'payout:approve'))
    assert.isTrue(await memberHasPermission(ownerUserId, organisationId, 'roles:manage'))
  })

  test('non-membre → refusé', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    assert.isFalse(await memberHasPermission(randomUUID(), organisationId, 'wallet:view'))
  })

  test('membre à rôle restreint → seulement ses permissions', async ({ assert }) => {
    const organisationId = await createOrg(randomUUID())
    const create = await app.container.make(CreateRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: 'Lecture Seule',
      permissionSlugs: ['wallet:view', 'transactions:view'],
    })

    const memberUserId = randomUUID()
    const member = new OrganisationMember()
    member.organisationId = organisationId
    member.userId = memberUserId
    member.roleId = role.id
    member.status = MemberStatus.ACTIVE
    await member.save()

    assert.isTrue(await memberHasPermission(memberUserId, organisationId, 'wallet:view'))
    assert.isFalse(await memberHasPermission(memberUserId, organisationId, 'roles:manage'))
    // tableau : vrai si au moins une accordée
    assert.isTrue(
      await memberHasPermission(memberUserId, organisationId, ['roles:manage', 'transactions:view'])
    )
    assert.isFalse(
      await memberHasPermission(memberUserId, organisationId, ['roles:manage', 'payout:approve'])
    )
  })
})

test.group('Business roles | porte HTTP (middleware orgPermission)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('OWNER authentifié → 200 sur la liste des rôles', async ({ client, assert }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const token = await User.accessTokens.create(owner, [appAbility(AppName.AIGLEBUSINESS)])

    const res = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    res.assertStatus(200)
    assert.isArray(res.body())
  })

  test('token aiglesend sur /business → 403 (cloisonnement)', async ({ client }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const token = await User.accessTokens.create(owner, [appAbility(AppName.AIGLESEND)])

    const res = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    res.assertStatus(403)
  })

  test('token sans stamp d’app → 401 (re-login)', async ({ client }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const token = await User.accessTokens.create(owner)

    const res = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    res.assertStatus(401)
  })

  test('utilisateur non-membre → 403', async ({ client }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)

    const outsider = await makeUser()
    const token = await User.accessTokens.create(outsider, [appAbility(AppName.AIGLEBUSINESS)])

    const res = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    res.assertStatus(403)
  })

  test('sans jeton → 401', async ({ client }) => {
    const organisationId = await createOrg(randomUUID())
    const res = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
    res.assertStatus(401)
  })
})

test.group('Business RBAC | enforcement par permission (Lot D)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  /** Crée un membre ACTIF avec un rôle portant `permissionSlugs`, et renvoie son jeton business. */
  async function memberBearer(organisationId: string, permissionSlugs: string[]): Promise<string> {
    const create = await app.container.make(CreateRoleUseCase)
    const role = await create.execute({
      organisationId,
      name: `Role ${randomUUID().slice(0, 8)}`,
      permissionSlugs,
    })
    const user = await makeUser()
    const member = new OrganisationMember()
    member.organisationId = organisationId
    member.userId = user.usersUid
    member.roleId = role.id
    member.status = MemberStatus.ACTIVE
    await member.save()
    const token = await User.accessTokens.create(user, [appAbility(AppName.AIGLEBUSINESS)])
    return token.value!.release()
  }

  test('membre avec members:manage → 200 sur GET members', async ({ client, assert }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const bearer = await memberBearer(organisationId, ['members:manage'])

    const res = await client
      .get(`/api/business/organisations/${organisationId}/members`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.isArray(res.body())
  })

  test('granularité : roles:manage donne accès aux rôles mais pas aux membres', async ({
    client,
  }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const bearer = await memberBearer(organisationId, ['roles:manage'])

    // La même personne : autorisée sur les rôles…
    const onRoles = await client
      .get(`/api/business/organisations/${organisationId}/roles`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)
    onRoles.assertStatus(200)

    // …mais refusée sur les membres (permission différente, garde par sous-groupe).
    const onMembers = await client
      .get(`/api/business/organisations/${organisationId}/members`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)
    onMembers.assertStatus(403)
    onMembers.assertBodyContains({ code: 'E_FORBIDDEN_ORG_PERMISSION' })
  })

  test('membre sans la permission requise → 403', async ({ client }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const bearer = await memberBearer(organisationId, ['wallet:view'])

    const res = await client
      .get(`/api/business/organisations/${organisationId}/members`)
      .header('X-Client-Channel', 'web')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(403)
  })

  test('refus RBAC → audit PERMISSION_DENIED (FAILURE) émis', async ({ client, assert }) => {
    const owner = await makeUser()
    const organisationId = await createOrg(owner.usersUid)
    const bearer = await memberBearer(organisationId, ['wallet:view'])

    const events: Array<Record<string, any>> = []
    const capture = (e: Record<string, any>) => events.push(e)
    emitter.on('activity:audit', capture)

    try {
      const res = await client
        .get(`/api/business/organisations/${organisationId}/members`)
        .header('X-Client-Channel', 'web')
        .header('Authorization', `Bearer ${bearer}`)
      res.assertStatus(403)
    } finally {
      emitter.off('activity:audit', capture)
    }

    // La tentative refusée est tracée pour la détection d'escalade.
    const denial = events.find((e) => e.eventAction === 'PERMISSION_DENIED')
    assert.exists(denial)
    assert.equal(denial!.result, 'failed') // AuditResult.FAILURE
    assert.equal(denial!.errorCode, 'E_FORBIDDEN_ORG_PERMISSION')
    assert.equal(denial!.metadata.permission, 'members:manage')
  })
})
