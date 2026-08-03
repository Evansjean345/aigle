import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Account from '#core/identity/account/domain/models/account'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Ledger from '#core/money/ledger/domain/models/ledger'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import TransferItemProcessor from '#core/money/transfer/application/services/transfer_item_processor'
import Transaction from '#core/money/transactions/domain/models/transaction'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import { ProviderResponse } from '#core/money/provider_gateway/domain/value_objects/provider_response'
import { ErrorSeverity } from '#core/money/provider_gateway/domain/enums/error_severity'
import PartyValidator from '#core/money/money_movement/application/services/party_validator'
import {
  PermissivePartyValidator,
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

  // Le compte porteur : l'envoi vérifie qu'il est toujours actif avant de verser.
  const account = new Account()
  account.accountId = orgId
  account.ownerType = AccountOwnerType.ORGANISATION
  account.ownerRef = orgId
  account.segment = AccountSegment.ENTERPRISE
  account.level = 1
  account.status = AccountStatus.ACTIVE
  await account.save()

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

  /**
   * B10 / L2-D28 — le scénario que le figeage existe pour empêcher.
   *
   * Entre l'initiation (où les frais sont calculés et **réservés**) et l'envoi, la grille tarifaire
   * peut changer. Si le drain recalculait, la transaction porterait une fee différente de celle
   * couverte par le hold → rupture d'invariant de fonds. On simule une grille qui a doublé et on
   * vérifie que la transaction porte toujours la fee **gravée sur l'item**.
   */
  test('drain : la transaction porte la fee FIGÉE, même si la grille a changé depuis', async ({
    assert,
  }) => {
    const FROZEN_FEE = 250
    const { item } = await makeQueuedItem(80000, 20000)

    item.fees = FROZEN_FEE
    await item.save()

    // La grille a bougé depuis l'initiation : elle facturerait désormais bien plus cher.
    app.container.swap(
      FeeResolver,
      () =>
        ({
          resolve: async (_ctx: unknown, amount: number) => ({
            amount,
            fees: 9999,
            total: amount + 9999,
          }),
        }) as any
    )

    try {
      const processor = await app.container.make(TransferItemProcessor)
      await processor.process(item.id)
    } finally {
      app.container.restore(FeeResolver)
    }

    await item.refresh()
    assert.equal(item.status, TransferItemStatus.SENT)

    const tx = await Transaction.query()
      .where('reference', item.transactionReference!)
      .firstOrFail()

    // La fee réservée, pas la nouvelle grille.
    assert.equal(Number(tx.fees), FROZEN_FEE)
    assert.equal(Number(tx.totalAmount), 20000 + FROZEN_FEE)
  })

  test('portefeuille gelé après approbation : item suspendu, ni versé ni rendu', async ({
    assert,
  }) => {
    const { wallet, item } = await makeQueuedItem(80000, 20000)

    wallet.status = WalletStatus.Inactive
    await wallet.save()

    // La garde réelle, que `swapGuards` neutralise par défaut.
    app.container.restore(PartyValidator)

    try {
      const processor = await app.container.make(TransferItemProcessor)
      await processor.process(item.id)
    } finally {
      app.container.swap(PartyValidator, () => new PermissivePartyValidator() as any)
    }

    await item.refresh()

    assert.equal(item.status, TransferItemStatus.QUEUED)
    assert.isNotNull(item.nextRetryAt)
    assert.equal(item.attempts, 0, 'le gel ne consomme pas de tentative')
    assert.isNull(item.transactionReference, "aucun versement n'a été tenté")
    assert.equal(await reloadBalance(wallet.id), 80000, 'le hold est conservé')
  })
})
