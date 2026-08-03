import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Admin from '#core/team/domain/models/admin'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'
import { ADMIN_PERMISSIONS } from '#core/team/presentation/permissions.config'
import { LEDGER_PERMISSIONS } from '#core/money/ledger/presentation/admin/permissions.config'

/**
 * Les deux styles de garde du back-office : `middleware.permission` sur `/team`, policy bouncer sur
 * `/ledgers`. Ils doivent répondre la même chose aux mêmes situations.
 */

const TEAM_URL = '/api/admin/team'
const LEDGERS_URL = '/api/admin/ledgers'

async function makeRole(slug: string, permissionSlugs: string[] = []): Promise<Role> {
  const role = await Role.updateOrCreate({ slug }, { name: slug, description: slug })

  if (permissionSlugs.length > 0) {
    const permissions = await Permission.query().whereIn('slug', permissionSlugs)
    await role.related('permissions').sync(
      permissions.map((permission) => permission.id),
      false
    )
  }

  return role
}

async function makeAdmin(role: Role | null): Promise<string> {
  const admin = new Admin()
  admin.firstname = 'Test'
  admin.lastname = 'Admin'
  admin.email = `${randomUUID()}@aigle.test`
  admin.password = 'Motdepasse1!'
  admin.isActive = true

  if (role) {
    admin.roleId = role.id
  }

  await admin.save()

  if (!role) {
    await db.from('admins').where('id', admin.id).update({ role_id: null })
  }

  const token = await Admin.accessTokens.create(admin)

  return token.value!.release()
}

test.group('Team | gardes de permission', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  group.each.setup(async () => {
    await Permission.updateOrCreateMany(
      'slug',
      [ADMIN_PERMISSIONS.manage, LEDGER_PERMISSIONS.list].map((definition) => ({
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
      }))
    )
  })

  test('middleware : la permission détenue laisse passer', async ({ client, assert }) => {
    const role = await makeRole(`gestionnaire-${randomUUID().slice(0, 8)}`, [
      ADMIN_PERMISSIONS.manage.slug,
    ])
    const token = await makeAdmin(role)

    const response = await client.get(TEAM_URL).bearerToken(token)

    assert.notEqual(response.status(), 403)
    assert.notEqual(response.status(), 500)
  })

  test('middleware : la permission absente reçoit 403', async ({ client }) => {
    const role = await makeRole(`sans-droit-${randomUUID().slice(0, 8)}`)
    const token = await makeAdmin(role)

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('middleware : un administrateur sans rôle reçoit 403, pas 500', async ({ client }) => {
    const token = await makeAdmin(null)

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('middleware : le rôle root ne passe pas sans détenir la permission', async ({ client }) => {
    const role = await makeRole(`root-sans-droit-${randomUUID().slice(0, 8)}`)
    const token = await makeAdmin(role)

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('policy : la permission absente reçoit 403', async ({ client }) => {
    const role = await makeRole(`sans-droit-${randomUUID().slice(0, 8)}`)
    const token = await makeAdmin(role)

    const response = await client.get(LEDGERS_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('policy : un administrateur sans rôle reçoit 403, pas 500', async ({ client }) => {
    const token = await makeAdmin(null)

    const response = await client.get(LEDGERS_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('sans jeton, les deux gardes répondent 401', async ({ client }) => {
    const withoutToken = await client.get(TEAM_URL)
    const ledgersWithoutToken = await client.get(LEDGERS_URL)

    withoutToken.assertStatus(401)
    ledgersWithoutToken.assertStatus(401)
  })
})
