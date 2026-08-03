import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Ledger from '#core/money/ledger/domain/models/ledger'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import { reloadBalance } from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * B2 — Réservation (hold, option A / L2-D2, L2-D4).
 *
 * Le hold = **un débit gardé du total** + **une** écriture ledger de réservation écrite **sans
 * transaction** (`transaction_id = null`). Un échec de solde ne débite rien. `releaseHold` recrédite
 * le total + écrit une ligne de libération transaction-less. Invariant : hold puis release → solde
 * inchangé, deux lignes ledger qui s'annulent.
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

test.group('Transfer | réservation (hold) — B2', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('hold : débit gardé du total + ligne ledger de réservation SANS transaction', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const svc = await app.container.make(TransferReservationService)
    const { reservationRef } = await svc.hold(orgId, 60000, 'transfer_test_1')

    assert.equal(await reloadBalance(wallet.id), 40000)
    assert.isNotEmpty(reservationRef)

    const entry = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION)
      .firstOrFail()

    assert.isNull(entry.transactionId) // le hold n'a pas de transaction pour cause (L2-D4)
    assert.equal(entry.direction, LedgerDirection.DEBIT)
    assert.equal(Number(entry.amountBrut), 60000)
    assert.equal(String(entry.id), reservationRef)
  })

  test('hold : solde insuffisant → InsufficientFunds, aucun débit ni ledger', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(1000)

    const svc = await app.container.make(TransferReservationService)
    await assert.rejects(() => svc.hold(orgId, 60000, 'transfer_test_2'))

    assert.equal(await reloadBalance(wallet.id), 1000)
    const entries = await Ledger.query().where('wallet_id', wallet.id)
    assert.lengthOf(entries, 0)
  })

  test('releaseHold : recrédit du total + ligne ledger de libération SANS transaction', async ({
    assert,
  }) => {
    const { orgId, wallet } = await makeOrgWallet(100000)

    const svc = await app.container.make(TransferReservationService)
    await svc.hold(orgId, 60000, 'transfer_test_3')
    await svc.releaseHold(orgId, 60000, 'transfer_test_3')

    // Invariant : hold puis release → solde inchangé.
    assert.equal(await reloadBalance(wallet.id), 100000)

    const release = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.RESERVATION_RELEASE)
      .firstOrFail()

    assert.isNull(release.transactionId)
    assert.equal(release.direction, LedgerDirection.CREDIT)
    assert.equal(Number(release.amountBrut), 60000)
  })
})
