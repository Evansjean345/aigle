import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { ORGANISATION_PERMISSIONS } from '#aiglebusiness/organisation/presentation/admin/permissions.config'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * Liste des organisations vue depuis la route : validation des filtres et du tri.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt.
 */
test.group('Organisations HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([ORGANISATION_PERMISSIONS.list])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/organisations')
    response.assertStatus(401)
  })

  test('la liste répond', async ({ client }) => {
    const response = await client.get('/api/admin/organisations').bearerToken(await agent())
    response.assertStatus(200)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/organisations')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/organisations')
      .qs({ sortBy: 'id; DROP TABLE organisations' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('les trois tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of ['createdAt', 'level', 'name']) {
      const response = await client
        .get('/api/admin/organisations')
        .qs({ sortBy, order: 'asc' })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/organisations')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })
})
