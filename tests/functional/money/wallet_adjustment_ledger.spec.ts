import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Ledger from '#core/money/ledger/domain/models/ledger'
import WalletAdjustmentService from '#core/money/wallet/application/services/wallet_adjustment_service'
import { AdjustmentType, AdjustmentReason } from '#core/money/wallet/domain/enums/wallet_adjustment'
import { LedgerDirection, LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import { seedWallet, seedTransaction } from '#tests/helpers/money_test_helpers'

/**
 * Un ajustement laisse toujours une écriture au grand livre.
 *
 * C'est l'invariant que le livre porte : la somme de ses écritures égale le solde du portefeuille.
 * Un ajustement qui déplacerait l'argent sans écrire le romprait, et toute lecture bâtie sur le
 * livre — activité d'un compte, volumes, bandeau d'une organisation — sous-compterait d'autant.
 */
test.group('Ajustements | écriture au grand livre', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function service() {
    return app.container.make(WalletAdjustmentService)
  }

  test('un ajustement sans référence de transaction écrit quand même au livre', async ({
    assert,
  }) => {
    const wallet = await seedWallet({ balance: 5000 })

    await (
      await service()
    ).adjust({
      walletId: wallet.id,
      type: AdjustmentType.CREDIT,
      reason: AdjustmentReason.RECONCILIATION_GAP,
      amount: 1500,
      comment: 'Écart constaté au rapprochement du 18 août.',
      adminId: 1,
    })

    const entries = await Ledger.query().where('wallet_id', wallet.id)

    assert.lengthOf(entries, 1)
    assert.equal(entries[0].operationType, LedgerOperationType.ADJUSTMENT)
    assert.equal(entries[0].direction, LedgerDirection.CREDIT)
    assert.equal(Number(entries[0].totalAmount), 1500)
    assert.equal(Number(entries[0].balanceBefore), 5000)
    assert.equal(Number(entries[0].balanceAfter), 6500)
    assert.isNull(entries[0].transactionId)
  })

  test('un ajustement au débit écrit une sortie', async ({ assert }) => {
    const wallet = await seedWallet({ balance: 5000 })

    await (
      await service()
    ).adjust({
      walletId: wallet.id,
      type: AdjustmentType.DEBIT,
      reason: AdjustmentReason.DUPLICATE_CREDIT,
      amount: 300,
      comment: 'Crédit passé deux fois, correction du second.',
      adminId: 1,
    })

    const entry = await Ledger.query().where('wallet_id', wallet.id).firstOrFail()

    assert.equal(entry.direction, LedgerDirection.DEBIT)
    assert.equal(Number(entry.balanceAfter), 4700)
    assert.isNull(entry.transactionId)
  })

  test('un ajustement rattaché à une transaction la référence dans son écriture', async ({
    assert,
  }) => {
    const wallet = await seedWallet({ balance: 5000 })
    const transaction = await seedTransaction({ accountId: wallet.accountId ?? undefined })

    await (
      await service()
    ).adjust({
      walletId: wallet.id,
      type: AdjustmentType.CREDIT,
      reason: AdjustmentReason.MISSING_DEBIT,
      amount: 200,
      comment: 'Débit manquant sur la transaction rattachée.',
      adminId: 1,
      transactionReference: transaction.reference,
    })

    const entry = await Ledger.query()
      .where('wallet_id', wallet.id)
      .where('operation_type', LedgerOperationType.ADJUSTMENT)
      .firstOrFail()

    assert.equal(entry.transactionId, transaction.id)
  })

  test('le livre et le solde du portefeuille restent égaux après plusieurs ajustements', async ({
    assert,
  }) => {
    const wallet = await seedWallet({ balance: 0 })
    const adjustmentService = await service()

    await adjustmentService.adjust({
      walletId: wallet.id,
      type: AdjustmentType.CREDIT,
      reason: AdjustmentReason.SYSTEM_ERROR,
      amount: 1000,
      comment: 'Première correction, sans transaction rattachée.',
      adminId: 1,
    })

    await adjustmentService.adjust({
      walletId: wallet.id,
      type: AdjustmentType.DEBIT,
      reason: AdjustmentReason.OTHER,
      amount: 400,
      comment: 'Seconde correction, sans transaction rattachée.',
      adminId: 1,
    })

    const entries = await Ledger.query().where('wallet_id', wallet.id)
    const fromLedger = entries.reduce(
      (total, entry) =>
        entry.direction === LedgerDirection.CREDIT
          ? total + Number(entry.totalAmount)
          : total - Number(entry.totalAmount),
      0
    )

    await wallet.refresh()

    assert.lengthOf(entries, 2)
    assert.equal(fromLedger, Number(wallet.balance))
  })
})