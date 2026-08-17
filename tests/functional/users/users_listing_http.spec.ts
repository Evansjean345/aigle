import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { USER_PERMISSIONS } from '#aiglesend/user/presentation/admin/permissions.config'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'
import { makeUser } from '#tests/helpers/auth_test_helpers'

/**
 * Liste des utilisateurs vue depuis la route : validation des filtres et du tri.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt — c'est la route qui l'établit.
 */
test.group('Utilisateurs HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([USER_PERMISSIONS.usersRead])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/users')

    response.assertStatus(401)
  })

  test('la liste remonte les utilisateurs', async ({ client, assert }) => {
    const user = await makeUser()

    const response = await client.get('/api/admin/users').bearerToken(await agent())

    response.assertStatus(200)
    assert.include(
      response.body().data.map((entry: { usersUid: string }) => entry.usersUid),
      user.usersUid
    )
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/users')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/users')
      .qs({ sortBy: 'id; DROP TABLE users' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un tri déclaré ordonne la liste', async ({ client, assert }) => {
    await makeUser({ lastname: `Aaa${randomUUID().slice(0, 6)}` })
    await makeUser({ lastname: `Zzz${randomUUID().slice(0, 6)}` })

    const ascending = await client
      .get('/api/admin/users')
      .qs({ sortBy: 'lastname', order: 'asc', perPage: 5 })
      .bearerToken(await agent())

    const descending = await client
      .get('/api/admin/users')
      .qs({ sortBy: 'lastname', order: 'desc', perPage: 5 })
      .bearerToken(await agent())

    ascending.assertStatus(200)
    descending.assertStatus(200)

    const first = ascending.body().data[0]?.fullname
    const last = descending.body().data[0]?.fullname

    // Le premier d'un sens est le dernier de l'autre : le tri porte réellement.
    assert.notEqual(first, last, 'inverser le sens change la tête de liste')
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/users')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('sans tri, l’ordre reste le plus récent d’abord', async ({ client, assert }) => {
    await makeUser()
    await makeUser()

    const response = await client
      .get('/api/admin/users')
      .qs({ perPage: 100 })
      .bearerToken(await agent())

    response.assertStatus(200)

    const dates = response
      .body()
      .data.map((entry: { createdAt: string }) => new Date(entry.createdAt).getTime())
    const descending = [...dates].sort((a, b) => b - a)

    assert.deepEqual(dates, descending)
  })
})
