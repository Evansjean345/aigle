import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import Ledger from '#features/ledger/domain/models/ledger'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import TransfertUseCase from '#features/operations/application/use_cases/transfert.usecase'
import { TransfertRequestDto } from '#features/operations/application/dtos/transfert.dto'
import {
  createUserWithWallet,
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * Caractérisation du flux transfert — routage LOCAL (provider_gateway, Lot 3b).
 *
 * Fige le comportement ACTUEL : débit immédiat du wallet (réservation), transaction PENDING,
 * écriture ledger, initiation via provider_gateway (payout, montant total), échec fonds
 * insuffisants. Le fake ProviderResolver capture l'appel (aucun HTTP réel).
 */

function buildDto(overrides: Partial<Record<string, any>> = {}): TransfertRequestDto {
  return TransfertRequestDto.fromRequest(
    {
      amount: overrides.amount ?? 5000,
      service_type: 'transfert',
      provider_code: 'orange',
      provider_id: 6,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: overrides.phone ?? '0700000008',
      pincode: '1234',
      include_fees: overrides.include_fees ?? false,
    } as any,
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Flux transfert | caractérisation', (group) => {
  let restoreGuards: () => void

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    return async () => {
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('transfert nominal : débit immédiat, transaction PENDING, payout routé via provider_gateway', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    const gateway = swapProviderGateway()

    try {
      const useCase = await app.container.make(TransfertUseCase)
      const result = await useCase.execute(buildDto({ amount: 5000 }), user)

      // Réponse API PENDING
      assert.equal(result.data.status, TransactionStatus.PENDING)
      assert.isString(result.data.transactionReference)

      // Transaction PENDING DEBIT, frais 2% (fees=100, total=4900), débit immédiat du montant
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
      assert.equal(tx.direction, TransactionDirection.DEBIT)
      assert.equal(Number(tx.amount), 5000)
      assert.equal(Number(tx.fees), 100)
      assert.equal(Number(tx.totalAmount), 4900)
      assert.equal(await reloadBalance(wallet.id), 5000)

      // Payment PENDING au step TRANSFERT_INIT
      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.PENDING)
      assert.equal(pay.step, PaymentStep.TRANSFERT_INIT)

      // Écriture ledger DEBIT
      const ledger = await Ledger.query().where('transaction_id', tx.id).firstOrFail()
      assert.equal(ledger.direction, LedgerDirection.DEBIT)

      // provider_gateway invoqué : payout, montant TOTAL (net + frais), opérateur correct
      assert.lengthOf(gateway.resolver.invokes, 1)
      const invoke = gateway.resolver.invokes[0]
      assert.equal(invoke.operation, 'payout')
      assert.equal(invoke.resolve.operator, 'orange')
      assert.equal(invoke.request.amount, 4900)
      assert.equal(invoke.request.transactionId, tx.reference)
    } finally {
      gateway.restore()
    }
  })

  test('fonds insuffisants : rejet, aucun débit ni record, provider_gateway non invoqué', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 1000 })
    const gateway = swapProviderGateway()

    try {
      const useCase = await app.container.make(TransfertUseCase)

      await assert.rejects(
        () => useCase.execute(buildDto({ amount: 5000 }), user),
        "Vous n'avez pas de fonds suffisants pour effectuer cette opération"
      )

      assert.equal(await reloadBalance(wallet.id), 1000)
      const txs = await Transaction.query().where('users_uid', user.usersUid)
      assert.lengthOf(txs, 0)
      assert.lengthOf(gateway.resolver.invokes, 0)
    } finally {
      gateway.restore()
    }
  })
})
