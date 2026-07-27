import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Ledger from '#core/money/ledger/domain/models/ledger'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferItemProcessor from '#core/money/transfer/application/services/transfer_item_processor'
import { ProviderResponse } from '#core/money/provider_gateway/domain/value_objects/provider_response'
import { ErrorSeverity } from '#core/money/provider_gateway/domain/enums/error_severity'
import {
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * B4 — Exécution d'un item (`TransferItemProcessor`). Prefunded : aucun re-débit. Succès → `sent` ;
 * erreur définitive → `failed` + **release** de la part (invariant : wallet recrédité) ; erreur
 * retryable → `queued` + `next_retry_at`, **sans** release (le hold reste).
 *
 * Le wallet est monté au solde **post-hold** (100 000 réservés → 80 000) : le hold de 20 000 a déjà
 * été posé à l'initiation (B3) ; l'item pré-financé ne re-débite pas.
 */

async function makeQueuedItem(
  walletBalance: number,
  amount: number
): Promise<{ orgId: string; wallet: Wallet; batch: TransferBatch; item: TransferItem }> {
  const orgId = randomUUID()
  const wallet = new Wallet()
  wallet.accountId = orgId
  wallet.userId = null as unknown as string
  wallet.balance = walletBalance
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = WalletStatus.Active
  await wallet.save()

  const batch = new TransferBatch()
  batch.reference = `transfer_test_${randomUUID().slice(0, 8)}`
  batch.accountId = orgId
  batch.initiatedBy = 'member-x'
  batch.totalAmount = amount
  batch.fees = 0
  batch.currency = 'XOF'
  batch.expectedCount = 1
  batch.successfulCount = 0
  batch.failedCount = 0
  batch.status = TransferBatchStatus.QUEUED
  batch.reservationRef = 'ledger-hold-ref'
  await batch.save()

  const item = new TransferItem()
  item.batchId = batch.id
  item.idempotencyKey = `${batch.id}:0`
  item.sequence = 0
  item.amount = amount
  item.fees = 0
  item.currency = 'XOF'
  item.recipientPhone = '0700000001'
  item.operator = 'orange'
  item.country = 'ci'
  item.status = TransferItemStatus.QUEUED
  item.attempts = 0
  await item.save()

  return { orgId, wallet, batch, item }
}

test.group('Transfer | exécution item (B4)', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('succès : item → sent, provider appelé, wallet NON re-débité (prefunded)', async ({
    assert,
  }) => {
    const { wallet, item } = await makeQueuedItem(80000, 20000)

    const processor = await app.container.make(TransferItemProcessor)
    await processor.process(item.id)

    await item.refresh()
    assert.equal(item.status, TransferItemStatus.SENT)
    assert.isNotEmpty(item.providerReference)
    assert.isNotEmpty(item.transactionReference)
    assert.equal(await reloadBalance(wallet.id), 80000) // prefunded → aucun re-débit
  })

  test('erreur définitive : item → failed + release (wallet recrédité de la part)', async ({
    assert,
  }) => {
    const { wallet, item, batch } = await makeQueuedItem(80000, 20000)
    gateway.resolver.setResponse(
      ProviderResponse.failure({
        errorCode: 'HARD',
        errorMessage: 'numéro invalide',
        severity: ErrorSeverity.DEFINITIVE,
      })
    )

    const processor = await app.container.make(TransferItemProcessor)
    await processor.process(item.id)

    await item.refresh()
    assert.equal(item.status, TransferItemStatus.FAILED)
    assert.isNotEmpty(item.failureReason)
    assert.equal(item.attempts, 1)
    // Release : la part de l'item est recréditée (le hold est libéré pour cet item).
    assert.equal(await reloadBalance(wallet.id), 100000)

    // Un échec à l'envoi fait monter le compteur d'échec du lot et agrège (1/1 item → failed).
    await batch.refresh()
    assert.equal(batch.failedCount, 1)
    assert.equal(batch.status, TransferBatchStatus.FAILED)

    const release = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION_RELEASE)
      .first()
    assert.isNotNull(release)
  })

  test('erreur retryable : item → queued + next_retry_at, PAS de release', async ({ assert }) => {
    const { wallet, item } = await makeQueuedItem(80000, 20000)
    gateway.resolver.setResponse(
      ProviderResponse.failure({
        errorCode: 'RATE',
        errorMessage: '429 rate limit',
        severity: ErrorSeverity.RETRYABLE,
      })
    )

    const processor = await app.container.make(TransferItemProcessor)
    await processor.process(item.id)

    await item.refresh()
    assert.equal(item.status, TransferItemStatus.QUEUED)
    assert.isNotNull(item.nextRetryAt)
    assert.equal(item.attempts, 1)
    // Retryable → on garde le hold : aucun recrédit.
    assert.equal(await reloadBalance(wallet.id), 80000)
  })
})