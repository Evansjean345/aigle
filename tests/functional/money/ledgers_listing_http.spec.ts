import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LEDGER_PERMISSIONS } from '#core/money/ledger/presentation/admin/permissions.config'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { ledgerSortNames } from '#core/money/ledger/domain/types/ledger_sorts'
import { ledgerStatsPeriods } from '#core/money/ledger/presentation/admin/validators/list_ledgers_validator'
import { makeAdminWith } from '#tests/helpers/admin_test_helpers'

/**
 * Liste des écritures comptables vue depuis la route : validation des filtres et de la pagination.
 *
 * Ce que la validation refuse ne doit jamais atteindre le dépôt.
 */
test.group('Grands livres HTTP | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function agent() {
    const { token } = await makeAdminWith([LEDGER_PERMISSIONS.list, LEDGER_PERMISSIONS.export])
    return token
  }

  test('sans jeton, la liste est refusée', async ({ client }) => {
    const response = await client.get('/api/admin/ledgers')
    response.assertStatus(401)
  })

  test('la liste répond', async ({ client }) => {
    const response = await client.get('/api/admin/ledgers').bearerToken(await agent())
    response.assertStatus(200)
  })

  test('une page de taille démesurée est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ perPage: 100000 })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un sens hors de l’énumération est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ direction: 'INFLOW' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('le vocabulaire des transactions est accepté sur les écritures', async ({ client }) => {
    const token = await agent()

    // Une écriture rattachée à une transaction hérite du type de celle-ci : la colonne porte donc
    // aussi ces valeurs-là.
    for (const operationType of ['wallet_transfert', 'transfert', 'inter_reseau', 'checkout']) {
      const response = await client
        .get('/api/admin/ledgers')
        .qs({ operationType })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })

  test('un type hors des deux vocabulaires est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ operationType: 'virement' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un terme d’une seule lettre est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ search: 'a' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('un nom de colonne au tri est refusé', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ sortBy: 'total_amount' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('une injection au tri est refusée', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers')
      .qs({ sortBy: 'id; DROP TABLE ledgers' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('tous les tris déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const sortBy of ledgerSortNames) {
      for (const order of ['asc', 'desc']) {
        const response = await client
          .get('/api/admin/ledgers')
          .qs({ sortBy, order })
          .bearerToken(token)

        response.assertStatus(200)
      }
    }
  })

  test('tous les sens déclarés sont acceptés, quelle que soit leur casse', async ({ client }) => {
    const token = await agent()

    for (const direction of Object.values(LedgerDirection)) {
      const response = await client
        .get('/api/admin/ledgers')
        .qs({ direction: direction.toLowerCase() })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })

  test('tous les types d’opération déclarés sont acceptés', async ({ client }) => {
    const token = await agent()

    for (const operationType of Object.values(LedgerOperationType)) {
      const response = await client
        .get('/api/admin/ledgers')
        .qs({ operationType })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })

  test('une période inconnue est refusée par les compteurs', async ({ client }) => {
    const response = await client
      .get('/api/admin/ledgers/stats')
      .qs({ period: '365d' })
      .bearerToken(await agent())

    response.assertStatus(422)
  })

  test('les périodes déclarées sont acceptées par les compteurs', async ({ client }) => {
    const token = await agent()

    for (const period of ledgerStatsPeriods) {
      const response = await client
        .get('/api/admin/ledgers/stats')
        .qs({ period })
        .bearerToken(token)

      response.assertStatus(200)
    }
  })
})