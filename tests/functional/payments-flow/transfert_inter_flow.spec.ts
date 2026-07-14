import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import InterTransfertUseCase from '#aiglesend/operations/application/use_cases/transfert_inter.usecase'
import { InterTransfertRequestDto } from '#aiglesend/operations/application/dtos/transfert_inter.dto'
import { mobileDeviceDeepLink } from '#config/app'
import {
  createUserWithWallet,
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from './mocks/operations_fixtures.js'

/**
 * Caractérisation du flux transfert_inter — routage LOCAL (provider_gateway, Lot 3b), jambe 1.
 *
 * Fige le comportement ACTUEL : transaction PENDING direction EXTERNAL, 2 payments (dépôt PENDING
 * + transfert DRAFT), aucun mouvement wallet, initiation jambe 1 (cash-in) via provider_gateway
 * (checkout, montant net). La jambe 2 (déclenchée au webhook de la jambe 1) est hors périmètre.
 */

function buildDto(overrides: Partial<Record<string, any>> = {}): InterTransfertRequestDto {
  return InterTransfertRequestDto.fromRequest(
    {
      amount: overrides.amount ?? 5000,
      service_type: 'inter_reseau',
      include_fees: false,
      debitaire: {
        provider_id: 7,
        provider_code: 'moov',
        phone: overrides.debiteurPhone ?? '0700000009',
        payment_method_code: 'mobile-money',
        payment_method_id: 4,
        pincode: '1234',
      },
      beneficiaire: {
        provider_id: 6,
        provider_code: 'orange',
        phone: overrides.beneficiairePhone ?? '0700000010',
        payment_method_code: 'mobile-money',
        payment_method_id: 4,
      },
    } as any,
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Flux transfert_inter | caractérisation', (group) => {
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

  test('inter jambe 1 : transaction EXTERNAL PENDING, 2 payments, aucun mouvement wallet, checkout routé', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    const gateway = swapProviderGateway()

    try {
      const useCase = await app.container.make(InterTransfertUseCase)
      const result = await useCase.execute(buildDto({ amount: 5000 }), user)

      // Réponse API PENDING
      assert.equal(result.data.status, TransactionStatus.PENDING)
      assert.isString(result.data.transactionReference)

      // Transaction PENDING EXTERNAL, frais 4% (fees=200, total=4800), aucun mouvement wallet
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
      assert.equal(tx.direction, TransactionDirection.EXTERNAL)
      assert.equal(Number(tx.amount), 5000)
      assert.equal(Number(tx.fees), 200)
      assert.equal(Number(tx.totalAmount), 4800)
      assert.equal(await reloadBalance(wallet.id), 10000)

      // Deux payments : dépôt PENDING + transfert DRAFT
      const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
      assert.lengthOf(payments, 2)
      const statuses = payments.map((p) => p.status)
      assert.include(statuses, PaymentStatus.PENDING)
      assert.include(statuses, PaymentStatus.DRAFT)

      // provider_gateway invoqué pour la jambe 1 (cash-in débiteur) : checkout, montant net
      assert.lengthOf(gateway.resolver.invokes, 1)
      const invoke = gateway.resolver.invokes[0]
      assert.equal(invoke.operation, 'checkout')
      assert.equal(invoke.resolve.operator, 'moov')
      assert.equal(invoke.request.amount, 5000)
      assert.equal(invoke.request.transactionId, tx.reference)
    } finally {
      gateway.restore()
    }
  })

  test('inter jambe 1 : le PRODUIT envoie son deep link (success/error url) au provider', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const gateway = swapProviderGateway()

    try {
      const useCase = await app.container.make(InterTransfertUseCase)
      await useCase.execute(buildDto({ amount: 5000 }), user)

      // Jambe 1 = cash-in Orange (payment_link par défaut) : aiglesend consumer fournit son deep link.
      const invoke = gateway.resolver.invokes.at(-1)
      assert.exists(invoke)
      assert.equal(invoke!.request.metadata.success_url, mobileDeviceDeepLink)
      assert.equal(invoke!.request.metadata.error_url, mobileDeviceDeepLink)
    } finally {
      gateway.restore()
    }
  })
})
