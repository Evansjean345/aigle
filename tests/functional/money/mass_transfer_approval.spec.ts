import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import TransferApprovalService from '#core/money/transfer/application/services/transfer_approval_service'
import TransferRelayJob from '#core/money/transfer/application/jobs/transfer_relay_job'
import { reloadBalance } from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * B8 — Maker-checker (`TransferApprovalService`). Lot `pending_approval` → approve (`queued` + kick
 * relais) / reject (`rejected` + releaseHold). Séparation des tâches (approbateur ≠ initiateur, sauf
 * OWNER). Garde d'état sous verrou (re-action → 409).
 *
 * Le wallet est au solde **post-hold** (100 000 réservés → 80 000) : le hold de 20 000 a été posé à
 * l'initiation (B3). Un reject **libère** ce hold (recrédit).
 */

const INITIATOR = 'member-A'

async function makePendingBatch(): Promise<{ wallet: Wallet; batch: TransferBatch }> {
  const orgId = randomUUID()
  const wallet = new Wallet()
  wallet.accountId = orgId
  wallet.userId = null as unknown as string
  wallet.balance = 80000 // post-hold (100 000 − 20 000 réservés)
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = WalletStatus.Active
  await wallet.save()

  const batch = new TransferBatch()
  batch.reference = `transfer_test_${randomUUID().slice(0, 8)}`
  batch.accountId = orgId
  batch.initiatedBy = INITIATOR
  batch.totalAmount = 20000
  batch.fees = 0
  batch.currency = 'XOF'
  batch.expectedCount = 1
  batch.successfulCount = 0
  batch.failedCount = 0
  batch.status = TransferBatchStatus.PENDING_APPROVAL
  batch.reservationRef = 'ledger-hold-ref'
  await batch.save()

  return { wallet, batch }
}

test.group('Transfer | maker-checker (B8)', (group) => {
  let fake: ReturnType<typeof QueueManager.fake>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    fake = QueueManager.fake()
    return async () => {
      QueueManager.restore()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('approve par un membre ≠ initiateur → queued + relais kické', async ({ assert }) => {
    const { batch } = await makePendingBatch()

    const svc = await app.container.make(TransferApprovalService)
    await svc.approve(batch.reference, 'member-B', false)

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.QUEUED)
    assert.equal(batch.approvedBy, 'member-B')
    fake.assertPushed(TransferRelayJob)
  })

  test('approve par l’initiateur non-owner → 403 (séparation des tâches)', async ({ assert }) => {
    const { batch } = await makePendingBatch()

    const svc = await app.container.make(TransferApprovalService)
    await assert.rejects(() => svc.approve(batch.reference, INITIATOR, false))

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.PENDING_APPROVAL) // inchangé
  })

  test('approve par l’initiateur OWNER → autorisé (org à une personne)', async ({ assert }) => {
    const { batch } = await makePendingBatch()

    const svc = await app.container.make(TransferApprovalService)
    await svc.approve(batch.reference, INITIATOR, true)

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.QUEUED)
  })

  test('reject → rejected + releaseHold (wallet recrédité du total)', async ({ assert }) => {
    const { wallet, batch } = await makePendingBatch()

    const svc = await app.container.make(TransferApprovalService)
    await svc.reject(batch.reference, 'member-B', false, 'montants incorrects')

    await batch.refresh()
    assert.equal(batch.status, TransferBatchStatus.REJECTED)
    assert.equal(batch.approvedBy, 'member-B')
    assert.equal(await reloadBalance(wallet.id), 100000) // hold libéré
  })

  test('garde d’état : re-approve d’un lot déjà queued → 409', async ({ assert }) => {
    const { batch } = await makePendingBatch()

    const svc = await app.container.make(TransferApprovalService)
    await svc.approve(batch.reference, 'member-B', false)
    await assert.rejects(() => svc.approve(batch.reference, 'member-B', false))
  })
})