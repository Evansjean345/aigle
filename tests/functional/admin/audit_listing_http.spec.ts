import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { AUDIT_PERMISSIONS } from '#core/audit/presentation/admin/permissions.config'
import { auditLogSortNames } from '#core/audit/domain/types/audit_log_sorts'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * File d'audit vue depuis la route : validation des filtres et du tri.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt.
 */
test.group("Audit HTTP | file d'événements", (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([AUDIT_PERMISSIONS.auditRead])
    return token
  }

  test('sans jeton, la file est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/audit-logs')
    response.assertStatus(401)
  })

  test('sans la permission, la file est refusée', async ({ client }) => {
    const { token } = await makeAdminWith([])
    const response = await client.get('/api/admin/audit-logs').bearerToken(token)

    response.assertStatus(403)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ sortBy: 'id; DROP TABLE audit_logs' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un sens de tri inconnu est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ sortBy: 'occurredAt', order: 'ascending' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test("un statut hors de l'énumération du domaine est refusé", async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ result: 'error' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une page trop large est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ perPage: 500 })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('la file répond', async ({ client }) => {
    const response = await client.get('/api/admin/audit-logs').bearerToken(await agent())
    response.assertStatus(200)
  })

  test('tous les tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of auditLogSortNames) {
      for (const order of ['asc', 'desc']) {
        const response = await client
          .get('/api/admin/audit-logs')
          .qs({ sortBy, order })
          .bearerToken(token)

        response.assertStatus(200)
      }
    }
  })

  test("un statut de l'énumération passe, quelle que soit sa casse", async ({ client }) => {
    const token = await agent()

    for (const result of ['success', 'SUCCESS', 'Failed', 'pending']) {
      const response = await client
        .get('/api/admin/audit-logs')
        .qs({ result })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })

  test("les filtres d'enquête sont acceptés", async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({
        requestId: '4113e8ca-2d13-4541-9643-4a6bd19160df',
        ipAddress: '127.0.0.1',
        errorCode: 'E_INSUFFICIENT_BALANCE',
        initiatedByType: 'admin',
      })
      .bearerToken(await agent())

    response.assertStatus(200)
  })

  test('un terme contenant un joker est traité comme du texte', async ({ client }) => {
    const response = await client
      .get('/api/admin/audit-logs')
      .qs({ search: '100%_' })
      .bearerToken(await agent())

    response.assertStatus(200)
  })
})