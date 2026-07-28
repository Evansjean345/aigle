import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Wallet from '#core/money/wallet/domain/models/wallet'
import Ledger from '#core/money/ledger/domain/models/ledger'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'

/**
 * B12 — Ventilation montant/frais sur les lignes de réservation (L2-D36).
 *
 * Depuis B10, un hold vaut `Σ(montant + frais)`. La ligne ledger doit donc **ventiler** :
 * `amountBrut` = les montants versés, `fees` = les frais, `totalAmount` = la somme.
 *
 * Enjeu comptable réel : en mode prefunded, aucune ligne ledger n'est écrite par item (B1) — le hold
 * est le **seul** endroit où ces frais figurent au journal. À 0, ils sont invisibles, et la ligne
 * s'auto-contredit (`brut + frais ≠ total`).
 */

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

test.group('Transfer | ventilation des frais au ledger (réservation) — B12', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('hold : la ligne ventile montants et frais (brut + frais = total)', async ({ assert }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)
    const svc = await app.container.make(TransferReservationService)

    // 3 bénéficiaires : 17 805 de montants + 300 de frais = 18 105 réservés.
    await svc.hold(orgId, 17805, 'transfer_test_b12', undefined, 300)

    const line = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION)
      .firstOrFail()

    assert.equal(Number(line.amountBrut), 17805)
    assert.equal(Number(line.fees), 300)
    assert.equal(Number(line.totalAmount), 18105)
    // La ligne ne se contredit plus.
    assert.equal(Number(line.amountBrut) + Number(line.fees), Number(line.totalAmount))

    // Le wallet est bien débité du TOTAL (montants + frais), pas du seul principal.
    await wallet.refresh()
    assert.equal(Number(wallet.balance), 100000 - 18105)
  })

  test('release : la part libérée ventile symétriquement', async ({ assert }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)
    const svc = await app.container.make(TransferReservationService)

    await svc.hold(orgId, 17805, 'transfer_test_b12', undefined, 300)
    // Libération d'un item : 5 935 de montant + 100 de frais.
    await svc.releaseHold(orgId, 5935, 'transfer_test_b12', undefined, 100)

    const line = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION_RELEASE)
      .firstOrFail()

    assert.equal(Number(line.amountBrut), 5935)
    assert.equal(Number(line.fees), 100)
    assert.equal(Number(line.totalAmount), 6035)

    // Invariant : le wallet récupère montant ET frais (L2-D31).
    await wallet.refresh()
    assert.equal(Number(wallet.balance), 100000 - 18105 + 6035)
  })

  test('sans frais (transfert simple) : ventilation neutre, comportement inchangé', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)
    const svc = await app.container.make(TransferReservationService)

    await svc.hold(orgId, 60000, 'transfer_test_b12')

    const line = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION)
      .firstOrFail()

    assert.equal(Number(line.amountBrut), 60000)
    assert.equal(Number(line.fees), 0)
    assert.equal(Number(line.totalAmount), 60000)
    await wallet.refresh()
    assert.equal(Number(wallet.balance), 40000)
  })
})
