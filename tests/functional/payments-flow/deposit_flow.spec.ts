import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/transactions/domain/models/transaction'
import Payment from '#core/transactions/domain/models/payment'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#core/transactions/domain/enums/payment_status'
import { PaymentStep } from '#core/transactions/domain/enums/payment_step'
import { ProviderResponse } from '#core/provider_gateway/domain/value_objects/provider_response'
import DepositUseCase from '#aiglesend/operations/application/use_cases/deposit.usecase'
import { DepositRequestDto } from '#aiglesend/operations/application/dtos/deposit.dto'
import {
  createUserWithWallet,
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from './mocks/operations_fixtures.js'

/**
 * Caractérisation du flux deposit — routage LOCAL (provider_gateway, Lot 3b).
 *
 * Fige le comportement ACTUEL : transaction PENDING sans mouvement de wallet, initiation via
 * provider_gateway (checkout) — le fake ProviderResolver capture l'appel (aucun HTTP réel), et
 * porte la redirection (providers synchrones) dans la réponse. Le chemin HTTP vers aiglehub a été
 * supprimé (aiglehub absorbé).
 */

function buildDto(overrides: Partial<Record<string, any>> = {}): DepositRequestDto {
  return DepositRequestDto.fromRequest(
    {
      amount: overrides.amount ?? 5000,
      service_type: 'deposit',
      provider_code: overrides.provider_code ?? 'moov',
      provider_id: overrides.provider_id ?? 7,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: overrides.phone ?? '0700000005',
    },
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Flux deposit | caractérisation', (group) => {
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

  test('deposit : transaction PENDING, aucun mouvement wallet, checkout routé via provider_gateway', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    const gateway = swapProviderGateway()

    try {
      const useCase = await app.container.make(DepositUseCase)
      const result = await useCase.execute(buildDto({ amount: 5000 }), user)

      // Réponse API : PENDING (le webhook confirmera plus tard)
      assert.equal(result.data.status, TransactionStatus.PENDING)
      assert.isString(result.data.transactionReference)

      // Transaction PENDING CREDIT, frais 3% (fees=150, total=4850), aucun mouvement wallet
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
      assert.equal(tx.direction, TransactionDirection.CREDIT)
      assert.equal(Number(tx.amount), 5000)
      assert.equal(Number(tx.fees), 150)
      assert.equal(Number(tx.totalAmount), 4850)
      assert.equal(await reloadBalance(wallet.id), 10000)

      // Payment PENDING au step DEPOSIT_INIT
      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.PENDING)
      assert.equal(pay.step, PaymentStep.DEPOSIT_INIT)

      // provider_gateway invoqué : checkout, montant net, opérateur/référence corrects
      assert.lengthOf(gateway.resolver.invokes, 1)
      const invoke = gateway.resolver.invokes[0]
      assert.equal(invoke.operation, 'checkout')
      assert.equal(invoke.resolve.operationType, 'mobile-money')
      assert.equal(invoke.resolve.operator, 'moov')
      assert.equal(invoke.request.amount, 5000)
      assert.equal(invoke.request.transactionId, tx.reference)
    } finally {
      gateway.restore()
    }
  })

  test('deposit provider synchrone : redirectUrl du provider_gateway propagée', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000, phone: '2250700000006' })
    const gateway = swapProviderGateway()
    gateway.resolver.setResponse(
      ProviderResponse.success({
        providerReference: 'hub2-ref',
        redirectUrl: 'https://pay.aigle/redirect',
      })
    )

    try {
      const useCase = await app.container.make(DepositUseCase)
      const result = await useCase.execute(
        buildDto({ provider_code: 'orange', provider_id: 6, phone: '0700000007' }),
        user
      )

      assert.equal(result.data.status, TransactionStatus.PENDING)
      assert.equal(result.data.redirectUrl, 'https://pay.aigle/redirect')

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
      assert.equal(gateway.resolver.invokes[0].resolve.operator, 'orange')
    } finally {
      gateway.restore()
    }
  })
})
