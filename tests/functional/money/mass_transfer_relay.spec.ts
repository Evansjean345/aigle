import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import redis from '@adonisjs/redis/services/main'
import { QueueManager } from '@adonisjs/queue'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferRateGovernor from '#core/money/transfer/domain/interfaces/transfer_rate_governor'
import TransferRelayService from '#core/money/transfer/application/services/transfer_relay_service'

const GOVERNOR_KEY = 'transfer:egress:batch'

async function makeBatch(status: TransferBatchStatus, itemCount: number): Promise<TransferBatch> {
  const batch = new TransferBatch()
  batch.reference = `transfer_test_${randomUUID().slice(0, 8)}`
  batch.accountId = randomUUID()
  batch.initiatedBy = 'member-x'
  batch.totalAmount = itemCount * 1000
  batch.fees = 0
  batch.currency = 'XOF'
  batch.expectedCount = itemCount
  batch.successfulCount = 0
  batch.failedCount = 0
  batch.status = status
  await batch.save()

  for (let i = 0; i < itemCount; i++) {
    const item = new TransferItem()
    item.batchId = batch.id
    item.idempotencyKey = `${batch.id}:${i}`
    item.sequence = i
    item.amount = 1000
    item.fees = 0
    item.currency = 'XOF'
    item.recipientPhone = `070000000${i}`
    item.operator = 'orange'
    item.country = 'ci'
    item.status = TransferItemStatus.QUEUED
    item.attempts = 0
    await item.save()
  }
  return batch
}

// ── Gouverneur : token bucket Redis (débit réel) ─────────────────────────────
test.group('Transfer | gouverneur token bucket (B4b)', (group) => {
  group.each.setup(async () => {
    await redis.connection('limiter').del(GOVERNOR_KEY)
    return async () => {
      await redis.connection('limiter').del(GOVERNOR_KEY)
    }
  })

  test('capacité 7 : le seau se vide au fil des acquisitions (pas de recharge dans le tick)', async ({
    assert,
  }) => {
    const gov = await app.container.make(TransferRateGovernor)

    // Seau plein (7). On prélève par paquets de 5.
    assert.equal(await gov.tryAcquire(5), 5) // reste ~2
    assert.equal(await gov.tryAcquire(5), 2) // reste ~0
    assert.equal(await gov.tryAcquire(5), 0) // vide → rien accordé
  })
})

// ── Relais : sélection des items dus + dispatch, borné par les tokens ────────
test.group('Transfer | relais (B4b)', (group) => {
  let grantTokens = 100
  let fake: ReturnType<typeof QueueManager.fake>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    fake = QueueManager.fake()
    grantTokens = 100
    app.container.swap(
      TransferRateGovernor,
      () => ({ tryAcquire: async (max: number) => Math.min(max, grantTokens) }) as never
    )
    return async () => {
      app.container.restore(TransferRateGovernor)
      QueueManager.restore()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('tire les items dus d’un lot queued et dispatch un job par item', async ({ assert }) => {
    await makeBatch(TransferBatchStatus.QUEUED, 3)

    const relay = await app.container.make(TransferRelayService)
    const res = await relay.tick()

    assert.equal(res.dispatched, 3)
    assert.isFalse(res.throttled)
    assert.lengthOf(fake.getPushedJobs(), 3)
  })

  test('un lot pending_approval n’est JAMAIS tiré', async ({ assert }) => {
    await makeBatch(TransferBatchStatus.PENDING_APPROVAL, 4)

    const relay = await app.container.make(TransferRelayService)
    const res = await relay.tick()

    assert.equal(res.dispatched, 0)
    assert.lengthOf(fake.getPushedJobs(), 0)
  })

  test('le budget de tokens borne le nombre d’items dispatchés', async ({ assert }) => {
    grantTokens = 2
    await makeBatch(TransferBatchStatus.QUEUED, 5)

    const relay = await app.container.make(TransferRelayService)
    const res = await relay.tick()

    assert.equal(res.dispatched, 2) // 5 items dus, mais seulement 2 tokens
    assert.lengthOf(fake.getPushedJobs(), 2)
  })
})
