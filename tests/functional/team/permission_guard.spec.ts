import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { makeAdminRole, makeAdminToken, syncAdminPermissions } from '#tests/factories/admin_factory'
import { ADMIN_PERMISSIONS } from '#core/team/presentation/permissions.config'
import { LEDGER_PERMISSIONS } from '#core/money/ledger/presentation/admin/permissions.config'

/**
 * Les deux styles de garde du back-office : `middleware.permission` sur `/team`, policy bouncer sur
 * `/ledgers`. Ils doivent répondre la même chose aux mêmes situations.
 */

const TEAM_URL = '/api/admin/team'
const LEDGERS_URL = '/api/admin/ledgers'

test.group('Team | gardes de permission', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    await syncAdminPermissions()

    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('middleware : la permission détenue laisse passer', async ({ client, assert }) => {
    const token = await makeAdminToken(
      await makeAdminRole([ADMIN_PERMISSIONS.manage], 'gestionnaire')
    )

    const response = await client.get(TEAM_URL).bearerToken(token)

    assert.notEqual(response.status(), 403)
    assert.notEqual(response.status(), 500)
  })

  test('middleware : la permission absente reçoit 403', async ({ client }) => {
    const token = await makeAdminToken(await makeAdminRole([], 'sans-droit'))

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('middleware : un administrateur sans rôle reçoit 403, pas 500', async ({ client }) => {
    const token = await makeAdminToken(null)

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('middleware : le rôle root ne passe pas sans détenir la permission', async ({ client }) => {
    const token = await makeAdminToken(await makeAdminRole([], 'root-sans-droit'))

    const response = await client.get(TEAM_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('policy : la permission détenue laisse passer', async ({ client, assert }) => {
    const token = await makeAdminToken(await makeAdminRole([LEDGER_PERMISSIONS.list], 'comptable'))

    const response = await client.get(LEDGERS_URL).bearerToken(token)

    assert.notEqual(response.status(), 403)
    assert.notEqual(response.status(), 500)
  })

  test('policy : la permission absente reçoit 403', async ({ client }) => {
    const token = await makeAdminToken(await makeAdminRole([], 'sans-droit'))

    const response = await client.get(LEDGERS_URL).bearerToken(token)

    response.assertStatus(403)
  })

  test('policy : un administrateur sans rôle reçoit 403, pas 500', async ({ client }) => {
    const token = await makeAdminToken(null)

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
