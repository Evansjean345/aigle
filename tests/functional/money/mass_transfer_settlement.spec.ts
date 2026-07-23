import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferSettlementService from '#core/money/transfer/application/services/transfer_settlement_service'

/**
 * B5 — Settlement & agrégation du lot (service `TransferSettlementService.applyItemSettlement`).
 *
 * Le core `settle` (argent : SUCCESS / FAILED + refund = release) est le chemin existant, testé
 * ailleurs. Ici on teste le **suivi** : item réglé (gardé), compteurs atomiques du lot, agrégation
 * `completed`/`partial`/`failed`, idempotence, et no-op pour une transaction hors mass.
 */

async function makeSentBatch(refs: string[]): Promise<TransferBatch> {
  const batch = new TransferBatch()
  batch.reference = `transfer_test_${randomUUID().slice(0, 8)}`
  batch.accountId = randomUUID()
  batch.initiatedBy = 'member-x'
  batch.totalAmount = refs.length * 1000
  batch.fees = 0
  batch.currency = 'XOF'
  batch.expectedCount = refs.length
  batch.successfulCount = 0
  batch.failedCount = 0
  batch.status = TransferBatchStatus.QUEUED
  await batch.save()

  for (let i = 0; i < refs.length; i++) {
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
    item.status = TransferItemStatus.SENT // accepté par Hub2, en attente webhook
    item.transactionReference = refs[i]
    item.attempts = 1
    await item.save()
  }
  return batch
}

test.group('Transfer | settlement & agrégation (B5)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('succès partiel : 2 ok + 1 ko → batch partial, compteurs corrects', async ({ assert }) => {
    const batch = await makeSentBatch(['ref-0', 'ref-1', 'ref-2'])
    const svc = await app.container.make(TransferSettlementService)

    await svc.applyItemSettlement('ref-0', 'success')
    await svc.applyItemSettlement('ref-1', 'success')
    await svc.applyItemSettlement('ref-2', 'failure')

    await batch.refresh()
    assert.equal(batch.successfulCount, 2)
    assert.equal(batch.failedCount, 1)
    assert.equal(batch.status, TransferBatchStatus.PARTIAL)

    const items = await TransferItem.query().where('batch_id', batch.id).orderBy('sequence')
    assert.equal(items[0].status, TransferItemStatus.SUCCEEDED)
    assert.equal(items[1].status, TransferItemStatus.SUCCEEDED)
    assert.equal(items[2].status, TransferItemStatus.FAILED)
  })

  test('tous succès → completed', async ({ assert }) => {
    const batch = await makeSentBatch(['a', 'b'])
    const svc = await app.container.make(TransferSettlementService)

    await svc.applyItemSettlement('a', 'success')
    await svc.applyItemSettlement('b', 'success')

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.COMPLETED)
    assert.equal(batch.successfulCount, 2)
  })

  test('tous échecs → failed', async ({ assert }) => {
    const batch = await makeSentBatch(['a', 'b'])
    const svc = await app.container.make(TransferSettlementService)

    await svc.applyItemSettlement('a', 'failure')
    await svc.applyItemSettlement('b', 'failure')

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.FAILED)
    assert.equal(batch.failedCount, 2)
  })

  test('idempotence : rejeu du même settlement → pas de double comptage', async ({ assert }) => {
    const batch = await makeSentBatch(['a', 'b'])
    const svc = await app.container.make(TransferSettlementService)

    await svc.applyItemSettlement('a', 'success')
    await svc.applyItemSettlement('a', 'success') // rejeu

    await batch.refresh()
    assert.equal(batch.successfulCount, 1) // pas 2
    assert.equal(batch.failedCount, 0)
    assert.equal(batch.status, TransferBatchStatus.PROCESSING) // b pas encore réglé
  })

  test('référence hors mass → no-op (pas d’erreur, aucun effet)', async ({ assert }) => {
    const svc = await app.container.make(TransferSettlementService)
    await assert.doesNotReject(() => svc.applyItemSettlement('unknown-consumer-ref', 'success'))
  })
})