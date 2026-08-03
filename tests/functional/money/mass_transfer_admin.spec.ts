import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'

/**
 * Lectures admin du paiement en masse.
 *
 * Leur particularité est l'**absence de cloisonnement par compte** : c'est ce qui les rend utiles à
 * un admin, et dangereuses si un contrôleur client les appelait. Les tests fixent donc le contraste
 * avec les lectures cloisonnées, qui doivent continuer de filtrer.
 */

async function makeBatch(
  accountId: string,
  status: TransferBatchStatus = TransferBatchStatus.PENDING_APPROVAL
): Promise<TransferBatch> {
  const batch = new TransferBatch()
  batch.reference = `transfer_sup_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  batch.accountId = accountId
  batch.initiatedBy = 'member-init'
  batch.totalAmount = 100_000
  batch.fees = 1_000
  batch.currency = 'XOF'
  batch.expectedCount = 1
  batch.successfulCount = 0
  batch.failedCount = 0
  batch.status = status
  await batch.save()

  const item = new TransferItem()
  item.batchId = batch.id
  // Obligatoire en base : elle dédoublonne le rejeu d'un item lors du drain.
  item.idempotencyKey = `${batch.id}:0`
  item.sequence = 1
  item.recipientPhone = '0700000000'
  item.recipientName = 'Bénéficiaire'
  item.operator = 'wave'
  item.amount = 100_000
  item.country = 'ci'
  item.status = TransferItemStatus.SUCCEEDED
  item.attempts = 2
  item.transactionReference = `txn_sup_${batch.id}`
  item.providerReference = `WAVE-${batch.id}`
  item.fees = 1_000
  item.settledAt = DateTime.now()
  await item.save()

  return batch
}

test.group('Transfer | lectures admin des lots', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('la file admin traverse les organisations', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgA = randomUUID()
    const orgB = randomUUID()

    const a = await makeBatch(orgA)
    const b = await makeBatch(orgB)

    const refs = (await svc.listForAdmin()).map((batch) => batch.reference)

    // Le point du lot : un admin voit les lots de toutes les organisations.
    assert.include(refs, a.reference)
    assert.include(refs, b.reference)
  })

  test('la file admin se restreint à une organisation sur demande', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgA = randomUUID()
    const orgB = randomUUID()

    const a = await makeBatch(orgA)
    const b = await makeBatch(orgB)

    const refs = (await svc.listForAdmin(undefined, orgA)).map((batch) => batch.reference)

    assert.include(refs, a.reference)
    assert.notInclude(refs, b.reference)
  })

  test('la file admin filtre par statut', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgId = randomUUID()

    const attente = await makeBatch(orgId, TransferBatchStatus.PENDING_APPROVAL)
    const termine = await makeBatch(orgId, TransferBatchStatus.COMPLETED)

    const refs = (await svc.listForAdmin(TransferBatchStatus.PENDING_APPROVAL, orgId)).map(
      (batch) => batch.reference
    )

    assert.include(refs, attente.reference)
    assert.notInclude(refs, termine.reference)
  })

  test('le détail admin expose le compte et les bénéficiaires', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgId = randomUUID()
    const batch = await makeBatch(orgId)

    const detail = await svc.getBatchDetailForAdmin(batch.reference)

    assert.isNotNull(detail)
    assert.equal(detail!.accountId, orgId)
    assert.lengthOf(detail!.items, 1)
    assert.equal(detail!.items[0]!.recipientName, 'Bénéficiaire')
  })

  test('la lecture CLOISONNÉE reste cloisonnée : un autre compte ne voit rien', async ({
    assert,
  }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgA = randomUUID()
    const batch = await makeBatch(orgA)

    assert.isNull(await svc.getBatchDetail(randomUUID(), batch.reference))
    assert.lengthOf(await svc.listBatches(randomUUID()), 0)
  })

  test('une référence inconnue ne renvoie aucun détail', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    assert.isNull(await svc.getBatchDetailForAdmin('transfer_inexistant'))
  })

  test('le détail admin porte les références de traçabilité', async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const batch = await makeBatch(randomUUID())

    const detail = await svc.getBatchDetailForAdmin(batch.reference)
    const item = detail!.items[0]!

    // Ce sont ces deux références qu'un superviseur transmet pour faire tracer un versement.
    assert.equal(item.transactionReference, `txn_sup_${batch.id}`)
    assert.equal(item.providerReference, `WAVE-${batch.id}`)
    assert.equal(item.idempotencyKey, `${batch.id}:0`)
    assert.equal(item.attempts, 2)
    assert.isNotNull(item.settledAt)
    assert.equal(item.country, 'ci')
  })

  test("le contrat CLIENT n'expose aucune de ces colonnes", async ({ assert }) => {
    const svc = await app.container.make(TransferQueryService)
    const orgId = randomUUID()
    const batch = await makeBatch(orgId)

    const detail = await svc.getBatchDetail(orgId, batch.reference)
    // Les DTOs sont des classes : la conversion passe par `unknown`, faute de recouvrement de types.
    const item = detail!.items[0]! as unknown as Record<string, unknown>

    // Le cloisonnement des canaux tient par des DTO séparés, pas par la discipline de l'appelant :
    // ce test échoue si l'un se remet à dériver de l'autre.
    assert.notProperty(item, 'transactionReference')
    assert.notProperty(item, 'providerReference')
    assert.notProperty(item, 'idempotencyKey')
    assert.notProperty(item, 'attempts')
    assert.notProperty(detail as unknown as Record<string, unknown>, 'accountId')

    // Ce que le client doit continuer de voir.
    assert.equal(item.recipientName, 'Bénéficiaire')
    assert.equal(item.fees, 1_000)
  })
})
