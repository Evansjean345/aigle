import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import { reloadBalance } from '#tests/functional/payments-flow/mocks/operations_fixtures'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * B11 — Simulation de frais (L2-D33/D34).
 *
 * Répond à « **combien dois-je approvisionner ?** » : la simulation prend le **même payload** que
 * l'initiation et appelle la **même fonction de tarification**, donc le devis ne peut pas diverger
 * du débit réel. Elle confronte le coût au solde et renvoie le **manque à approvisionner**.
 *
 * Invariant central : **aucune écriture**. Une simulation ne crée ni lot, ni item, ni hold — sinon
 * un marchand qui compare plusieurs scénarios immobiliserait ses fonds sans le savoir.
 */

const FEE_PER_ITEM = 100

class FakeFeeResolver {
  shouldFail = false

  async resolve(_ctx: unknown, amount: number) {
    if (this.shouldFail) throw new Error('Aucune grille de frais pour cet opérateur')
    return { amount, fees: FEE_PER_ITEM, total: amount + FEE_PER_ITEM }
  }
}

async function makeOrgWallet(balance: number): Promise<{ orgId: string; wallet: Wallet }> {
  const orgId = randomUUID()
  const wallet = new Wallet()
  wallet.accountId = orgId
  wallet.userId = null as unknown as string
  wallet.balance = balance
  wallet.currencySymbol = 'XOF'
  wallet.qrcodeToken = randomUUID()
  wallet.status = WalletStatus.Active
  await wallet.save()
  return { orgId, wallet }
}

/** 3 bénéficiaires × 100 000 = 300 000 de montants (+ 3 × 100 de frais). */
function command(orgId: string): InitiateMassTransferCommand {
  return {
    accountId: orgId,
    initiatedBy: 'member-x',
    label: 'Salaires juillet',
    recipients: [
      { amount: 100000, phone: '0700000001', operator: 'orange' },
      { amount: 100000, phone: '0700000002', operator: 'wave' },
      { amount: 100000, phone: '0700000003', operator: 'moov' },
    ],
  }
}

test.group('Transfer | simulation de frais — B11', (group) => {
  let fees: FakeFeeResolver

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    fees = new FakeFeeResolver()
    app.container.swap(FeeResolver, () => fees as any)

    return async () => {
      app.container.restore(FeeResolver)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('solde insuffisant → shortfall = ce qu il manque exactement', async ({ assert }) => {
    // 300 000 de salaires + 300 de frais = 300 300 requis, 280 000 disponibles.
    const { orgId } = await makeOrgWallet(280000)

    const svc = await app.container.make(TransferBatchService)
    const sim = await svc.simulate(command(orgId))

    assert.equal(sim.expectedCount, 3)
    assert.equal(sim.totalAmount, 300000)
    assert.equal(sim.fees, 3 * FEE_PER_ITEM)
    assert.equal(sim.total, 300300)
    assert.equal(sim.balance, 280000)
    assert.equal(sim.shortfall, 20300)
  })

  test('solde suffisant → shortfall = 0 (jamais négatif)', async ({ assert }) => {
    const { orgId } = await makeOrgWallet(500000)

    const svc = await app.container.make(TransferBatchService)
    const sim = await svc.simulate(command(orgId))

    assert.equal(sim.total, 300300)
    assert.equal(sim.shortfall, 0)
  })

  test('simuler n écrit RIEN : aucun lot, aucun hold, solde intact', async ({ assert }) => {
    const { orgId, wallet } = await makeOrgWallet(500000)

    const svc = await app.container.make(TransferBatchService)
    await svc.simulate(command(orgId))
    await svc.simulate(command(orgId))

    // Deux simulations d'affilée ne doivent rien immobiliser.
    assert.equal(await reloadBalance(wallet.id), 500000)
    const batches = await TransferBatch.query().where('account_id', orgId)
    assert.lengthOf(batches, 0)
  })

  test('bénéficiaire non tarifable → rejet (détecte un trou de catalogue avant l initiation)', async ({
    assert,
  }) => {
    const { orgId } = await makeOrgWallet(500000)
    fees.shouldFail = true

    const svc = await app.container.make(TransferBatchService)
    await assert.rejects(() => svc.simulate(command(orgId)))
  })
})
