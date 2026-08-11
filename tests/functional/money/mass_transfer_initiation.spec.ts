import { test } from '@japa/runner'
import { makeOrgWallet } from '#tests/factories/wallet_factory'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import { reloadBalance } from '#tests/functional/payments-flow/mocks/operations_fixtures'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * B3 — Initiation JSON (service core `TransferBatchService.initiate`).
 *
 * Money-critique : idempotence de requête, **réservation** du total (hold), **bulk-insert** du lot
 * (`pending_approval`) + N items (`queued`), le tout atomique et **sans** réseau provider. (La façade
 * HTTP produit + le gate enterprise sont couverts en B9.)
 */

function command(orgId: string, idempotencyKey?: string): InitiateMassTransferCommand {
  return {
    accountId: orgId,
    initiatedBy: 'member-x',
    label: 'Salaires test',
    idempotencyKey,
    recipients: [
      { amount: 20000, phone: '0700000001', operator: 'orange' },
      { amount: 20000, phone: '0700000002', operator: 'wave' },
      { amount: 20000, phone: '0700000003', operator: 'moov', name: 'Employé 3' },
    ],
  }
}

test.group('Transfer | initiation mass (service core) — B3', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    // B3 teste l'idempotence, la réserve et le bulk-insert — PAS la tarification (couverte en B10).
    // Grille neutralisée à 0 pour que les soldes attendus restent déterministes et indépendants du
    // catalogue seedé.
    app.container.swap(
      FeeResolver,
      () =>
        ({
          resolve: async (_ctx: unknown, amount: number) => ({ amount, fees: 0, total: amount }),
        }) as any
    )

    return async () => {
      app.container.restore(FeeResolver)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('initiate : lot pending_approval + N items queued, fonds réservés', async ({ assert }) => {
    const { accountId: orgId, wallet } = await makeOrgWallet(100000)

    const svc = await app.container.make(TransferBatchService)
    const res = await svc.initiate(command(orgId, 'idem-1'))

    assert.equal(res.status, TransferBatchStatus.PENDING_APPROVAL)
    assert.equal(res.expectedCount, 3)
    assert.equal(res.totalAmount, 60000)
    assert.isFalse(res.alreadyExisted)

    // Fonds réservés (hold du total).
    assert.equal(await reloadBalance(wallet.id), 40000)

    const batch = await TransferBatch.query().where('reference', res.reference).firstOrFail()
    assert.equal(batch.status, TransferBatchStatus.PENDING_APPROVAL)
    assert.isNotNull(batch.reservationRef)

    const items = await TransferItem.query().where('batch_id', batch.id)
    assert.lengthOf(items, 3)
    assert.isTrue(items.every((i) => i.status === TransferItemStatus.QUEUED))
    assert.deepEqual(items.map((i) => i.idempotencyKey).sort(), [
      `${batch.id}:0`,
      `${batch.id}:1`,
      `${batch.id}:2`,
    ])
  })

  test('idempotence requête : rejeu même clé → même lot, pas de double réserve', async ({
    assert,
  }) => {
    const { accountId: orgId, wallet } = await makeOrgWallet(100000)

    const svc = await app.container.make(TransferBatchService)
    const first = await svc.initiate(command(orgId, 'idem-2'))
    const second = await svc.initiate(command(orgId, 'idem-2'))

    assert.equal(second.reference, first.reference)
    assert.isTrue(second.alreadyExisted)
    // Pas de double débit : le solde reste réservé une seule fois.
    assert.equal(await reloadBalance(wallet.id), 40000)

    const batches = await TransferBatch.query().where('idempotency_key', 'idem-2')
    assert.lengthOf(batches, 1)
  })

  test('solde insuffisant → InsufficientFunds, aucun lot créé', async ({ assert }) => {
    const { accountId: orgId, wallet } = await makeOrgWallet(1000)

    const svc = await app.container.make(TransferBatchService)
    await assert.rejects(() => svc.initiate(command(orgId, 'idem-3')))

    assert.equal(await reloadBalance(wallet.id), 1000)
    const batches = await TransferBatch.query().where('account_id', orgId)
    assert.lengthOf(batches, 0)
  })
})
