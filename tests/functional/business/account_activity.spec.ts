import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import GetAccountActivitySummaryUseCase from '#core/money/transactions/application/use_cases/get_account_activity_summary.use_case'
import GetAccountActivityChartUseCase from '#core/money/transactions/application/use_cases/get_account_activity_chart.use_case'
import { LedgerDirection } from '#core/money/ledger/domain/ledger_enums'
import { seedAccountWithWallet, seedLedger } from '#tests/helpers/money_test_helpers'

/**
 * Activité d'un compte telle que le tableau de bord business l'affiche.
 *
 * Les totaux viennent du grand livre : ce qui est entré et ce qui est sorti, pas ce qui a été
 * demandé.
 */

const day = (offset: number = 0) => DateTime.now().minus({ days: offset })
const asDate = (value: DateTime) => value.toFormat('yyyy-MM-dd')

test.group('Activité du compte | résumé', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sépare ce qui entre de ce qui sort', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivitySummaryUseCase)
    const { accountId, wallet, transaction } = await seedAccountWithWallet()

    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.CREDIT,
      amount: 5000,
    })
    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.DEBIT,
      amount: 2000,
    })

    const summary = await useCase.execute(accountId)

    assert.equal(summary.withdrawalTotal, 5000, 'les encaissements sont ce qui entre')
    assert.equal(summary.payoutTotal, 2000, 'les transferts sont ce qui sort')
  })

  test('un compte sans portefeuille rend des totaux à zéro', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivitySummaryUseCase)

    const summary = await useCase.execute(randomUUID())

    assert.equal(summary.withdrawalTotal, 0)
    assert.equal(summary.payoutTotal, 0)
    assert.isEmpty(summary.recentTransactions)
  })

  test('joint les dernières transactions du compte', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivitySummaryUseCase)
    const { accountId, transaction } = await seedAccountWithWallet()

    const summary = await useCase.execute(accountId)

    assert.lengthOf(summary.recentTransactions, 1)
    assert.equal(summary.recentTransactions[0].reference, transaction.reference)
  })
})

test.group('Activité du compte | courbe', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('rend un point par jour mouvementé', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivityChartUseCase)
    const { accountId, wallet, transaction } = await seedAccountWithWallet()

    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.CREDIT,
      amount: 3000,
      day: day(1),
    })
    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.DEBIT,
      amount: 1000,
    })

    const chart = await useCase.execute(accountId, asDate(day(1)), asDate(day()))

    assert.lengthOf(chart, 2)
    assert.equal(chart[0].date, asDate(day(1)), 'du plus ancien au plus récent')
    assert.equal(chart[0].withdrawal, 3000)
    assert.equal(chart[1].payout, 1000)
  })

  test('un jour sans écriture est absent de la courbe', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivityChartUseCase)
    const { accountId, wallet, transaction } = await seedAccountWithWallet()

    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.CREDIT,
      amount: 3000,
    })

    const chart = await useCase.execute(accountId, asDate(day(6)), asDate(day()))

    assert.lengthOf(chart, 1, 'six jours creux ne produisent aucun point')
  })

  test('la période borne la courbe', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivityChartUseCase)
    const { accountId, wallet, transaction } = await seedAccountWithWallet()

    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.CREDIT,
      amount: 3000,
      day: day(10),
    })
    await seedLedger({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction: LedgerDirection.CREDIT,
      amount: 4000,
    })

    const chart = await useCase.execute(accountId, asDate(day(2)), asDate(day()))

    assert.lengthOf(chart, 1, 'l’écriture d’il y a dix jours est hors période')
    assert.equal(chart[0].withdrawal, 4000)
  })

  test('un compte sans écriture rend une courbe vide', async ({ assert }) => {
    const useCase = await app.container.make(GetAccountActivityChartUseCase)

    const chart = await useCase.execute(randomUUID(), asDate(day(6)), asDate(day()))

    assert.isEmpty(chart)
  })
})
