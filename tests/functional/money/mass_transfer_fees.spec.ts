import { test } from '@japa/runner'
import { makeOrgWallet } from '#tests/factories/wallet_factory'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import { reloadBalance } from '#tests/functional/payments-flow/mocks/operations_fixtures'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * B10 — Frais du paiement en masse.
 *
 * Money-critique : les frais sont **calculés par bénéficiaire** (L2-D30, grille `transfert`) et
 * **figés** sur l'item à l'initiation (L2-D28). La réserve doit couvrir `Σ(montant + frais)` — sinon
 * la transaction créée au drain porterait des frais que le hold ne couvre pas (rupture d'invariant).
 *
 * Un échec de tarification rejette **tout le lot** (L2-D32) : on est avant tout mouvement d'argent,
 * et un lot silencieusement amputé ferait approuver autre chose que la demande du client.
 */

const FEE_PER_ITEM = 100

/** Grille doublée : tarif fixe connu, ou échec dicté (pour le cas non tarifable). */
class FakeFeeResolver {
  shouldFail = false

  async resolve(_ctx: unknown, amount: number) {
    if (this.shouldFail) {
      throw new Error('Aucune grille de frais pour cet opérateur')
    }
    return { amount, fees: FEE_PER_ITEM, total: amount + FEE_PER_ITEM }
  }
}

function command(orgId: string, key?: string): InitiateMassTransferCommand {
  return {
    accountId: orgId,
    initiatedBy: 'member-x',
    label: 'Salaires test',
    idempotencyKey: key,
    recipients: [
      { amount: 20000, phone: '0700000001', operator: 'orange' },
      { amount: 20000, phone: '0700000002', operator: 'wave' },
      { amount: 20000, phone: '0700000003', operator: 'moov' },
    ],
  }
}

test.group('Transfer | frais du paiement en masse — B10', (group) => {
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

  test('initiation : hold = Σ(montant + frais), frais figés sur chaque item', async ({
    assert,
  }) => {
    const { accountId: orgId, wallet } = await makeOrgWallet(100000)

    const svc = await app.container.make(TransferBatchService)
    const res = await svc.initiate(command(orgId, `idem-${randomUUID()}`))

    // 3 × 20 000 de montant + 3 × 100 de frais.
    assert.equal(res.totalAmount, 60000)

    const batch = await TransferBatch.query().where('reference', res.reference).firstOrFail()
    assert.equal(Number(batch.fees), 3 * FEE_PER_ITEM)

    // La réserve couvre montant ET frais — c'est l'invariant que B10 ferme.
    assert.equal(await reloadBalance(wallet.id), 100000 - 60000 - 3 * FEE_PER_ITEM)

    // Frais gravés sur chaque item (figés : le drain les réutilisera sans recalcul).
    const items = await TransferItem.query().where('batch_id', batch.id)
    assert.lengthOf(items, 3)
    assert.isTrue(items.every((i) => Number(i.fees) === FEE_PER_ITEM))
  })

  test('bénéficiaire non tarifable → tout le lot rejeté, aucun hold posé', async ({ assert }) => {
    const { accountId: orgId, wallet } = await makeOrgWallet(100000)
    fees.shouldFail = true

    const svc = await app.container.make(TransferBatchService)
    await assert.rejects(() => svc.initiate(command(orgId, `idem-${randomUUID()}`)))

    // Rien créé, rien réservé : l'échec le moins cher possible (L2-D32).
    assert.equal(await reloadBalance(wallet.id), 100000)
    const batches = await TransferBatch.query().where('account_id', orgId)
    assert.lengthOf(batches, 0)
  })

  test('solde couvrant les montants mais PAS les frais → rejet (pas de hold partiel)', async ({
    assert,
  }) => {
    // 60 000 de montants + 300 de frais > 60 100 disponibles.
    const { accountId: orgId, wallet } = await makeOrgWallet(60100)

    const svc = await app.container.make(TransferBatchService)
    await assert.rejects(() => svc.initiate(command(orgId, `idem-${randomUUID()}`)))

    assert.equal(await reloadBalance(wallet.id), 60100)
  })
})
