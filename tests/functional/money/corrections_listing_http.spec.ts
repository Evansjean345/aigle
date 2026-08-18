import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { REFUND_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'
import { WALLET_ADJUSTMENT_PERMISSIONS } from '#aiglesend/wallet/presentation/admin/permissions.config'
import { refundSortNames } from '#core/money/transactions/domain/types/refund_sorts'
import { walletAdjustmentSortNames } from '#core/money/wallet/domain/types/wallet_adjustment_sorts'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * Listes des corrections vues depuis la route : validation des filtres et du tri.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt.
 */
test.group('Remboursements HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([REFUND_PERMISSIONS.list])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/transactions/refunds')
    response.assertStatus(401)
  })

  test('la liste répond', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions/refunds')
      .bearerToken(await agent())

    response.assertStatus(200)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions/refunds')
      .qs({ sortBy: 'executed_at' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions/refunds')
      .qs({ sortBy: 'id; DROP TABLE refunds' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/transactions/refunds')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('tous les tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of refundSortNames) {
      for (const order of ['asc', 'desc']) {
        const response = await client
          .get('/api/admin/transactions/refunds')
          .qs({ sortBy, order })
          .bearerToken(token)

        response.assertStatus(200)
      }
    }
  })
})

test.group('Ajustements HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([WALLET_ADJUSTMENT_PERMISSIONS.list])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/wallets/adjustments')
    response.assertStatus(401)
  })

  test('la liste répond', async ({ client }) => {
    const response = await client.get('/api/admin/wallets/adjustments').bearerToken(await agent())
    response.assertStatus(200)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/wallets/adjustments')
      .qs({ sortBy: 'balance_after' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/wallets/adjustments')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un compte qui n’est pas un uuid est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/wallets/adjustments')
      .qs({ accountId: '1 OR 1=1' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('tous les tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of walletAdjustmentSortNames) {
      for (const order of ['asc', 'desc']) {
        const response = await client
          .get('/api/admin/wallets/adjustments')
          .qs({ sortBy, order })
          .bearerToken(token)

        response.assertStatus(200)
      }
    }
  })
})