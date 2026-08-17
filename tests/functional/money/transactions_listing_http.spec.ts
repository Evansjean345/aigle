import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { TRANSACTION_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { transactionSortNames } from '#core/money/transactions/domain/types/transaction_sorts'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * Liste des transactions vue depuis la route : validation des filtres et de la pagination.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt.
 */
test.group('Transactions HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([TRANSACTION_PERMISSIONS.list])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/transactions')
    response.assertStatus(401)
  })

  test('la liste répond', async ({ client }) => {
    const response = await client.get('/api/admin/transactions').bearerToken(await agent())
    response.assertStatus(200)
  })

  test('une page de taille démesurée est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ perPage: 100000 })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un statut hors de l’énumération est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ status: 'reversed' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un type hors de l’énumération est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ type: 'payout' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un identifiant de compte qui n’est pas un uuid est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ accountId: '1 OR 1=1' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ sortBy: 'created_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions')
      .qs({ sortBy: 'id; DROP TABLE transactions' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('tous les tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of transactionSortNames) {
      for (const order of ['asc', 'desc']) {
        const response = await client
          .get('/api/admin/transactions')
          .qs({ sortBy, order })
          .bearerToken(token)

        response.assertStatus(200)
      }
    }
  })

  test('tous les types déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const type of Object.values(TransactionType)) {
      const response = await client.get('/api/admin/transactions').qs({ type }).bearerToken(token)
      response.assertStatus(200)
    }
  })

  test('tous les statuts déclarés sont acceptés, quelle que soit leur casse', async ({ client }) => {
    const token = await agent()

    for (const status of Object.values(TransactionStatus)) {
      const response = await client
        .get('/api/admin/transactions')
        .qs({ status: status.toUpperCase() })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })
})
