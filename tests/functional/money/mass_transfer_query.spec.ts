import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import {
  assertOrganisationIsEnterprise,
  type OrganisationTypeLookup,
} from '#aiglebusiness/shared/authorization/enterprise_policy'
import MassTransferEnterpriseOnlyException from '#aiglebusiness/transfer/mass/domain/exceptions/mass_transfer_enterprise_only_exception'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'

/** Le gate est désormais mutualisé ; le mass transfer lui fournit son propre code d'erreur. */
const denyMass = () => new MassTransferEnterpriseOnlyException()

/**
 * Lecture de type d'organisation mockée (ou `null` = introuvable).
 *
 * Aucune assertion de type : le gate ne réclame qu'une lecture, pas le port complet, donc ce
 * bouchon est vérifié par le compilateur. La version précédente passait par
 * `as unknown as OrganisationRepository`, qui aurait continué de compiler même si la signature
 * réellement appelée avait changé.
 */
function fakeOrgRepo(accountType: OrganisationAccountType | null): OrganisationTypeLookup {
  return {
    async findByOrganisationId() {
      return accountType ? { accountType } : null
    },
  }
}

async function makeBatch(
  accountId: string,
  status: TransferBatchStatus,
  itemCount = 0
): Promise<TransferBatch> {
  const batch = new TransferBatch()
  batch.reference = `transfer_test_${randomUUID().slice(0, 8)}`
  batch.accountId = accountId
  batch.initiatedBy = 'member-x'
  batch.label = 'Salaires test'
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

// ── Gate ENTERPRISE (L2-D23) ─────────────────────────────────────────────────
test.group('Transfer | gate enterprise (B9)', () => {
  test('enterprise → autorisé', async () => {
    await assertOrganisationIsEnterprise(
      fakeOrgRepo(OrganisationAccountType.ENTERPRISE),
      'org-1',
      denyMass
    )
  })

  test('marchand → 403', async ({ assert }) => {
    await assert.rejects(() =>
      assertOrganisationIsEnterprise(
        fakeOrgRepo(OrganisationAccountType.MARCHAND),
        'org-1',
        denyMass
      )
    )
  })

  test('org introuvable → 403', async ({ assert }) => {
    await assert.rejects(() => assertOrganisationIsEnterprise(fakeOrgRepo(null), 'org-1', denyMass))
  })
})

// ── Lecture (liste + détail, isolation par org) ──────────────────────────────
test.group('Transfer | lecture des lots (B9)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('listBatches : lots de l’org, filtrables par statut', async ({ assert }) => {
    const orgA = randomUUID()
    const orgB = randomUUID()
    await makeBatch(orgA, TransferBatchStatus.PENDING_APPROVAL)
    await makeBatch(orgA, TransferBatchStatus.QUEUED)
    await makeBatch(orgB, TransferBatchStatus.PENDING_APPROVAL)

    const svc = await app.container.make(TransferQueryService)

    assert.lengthOf(await svc.listBatches(orgA), 2)
    assert.lengthOf(await svc.listBatches(orgA, TransferBatchStatus.PENDING_APPROVAL), 1)
  })

  test('getBatchDetail : batch + items ; isolation par org', async ({ assert }) => {
    const orgA = randomUUID()
    const orgB = randomUUID()
    const batch = await makeBatch(orgA, TransferBatchStatus.PENDING_APPROVAL, 2)

    const svc = await app.container.make(TransferQueryService)

    const detail = await svc.getBatchDetail(orgA, batch.reference)
    assert.isNotNull(detail)
    assert.equal(detail!.reference, batch.reference)
    assert.lengthOf(detail!.items, 2)

    // Une autre org ne voit pas le lot (même en connaissant la référence).
    assert.isNull(await svc.getBatchDetail(orgB, batch.reference))
  })
})
