import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import DepositUseCase from '#features/operations/application/use_cases/deposit.usecase'
import InitiateDepositJob from '#features/money_movement/infrastructure/jobs/initiate_deposit_job'
import { DepositRequestDto } from '#features/operations/application/dtos/deposit.dto'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'
import FakeHttpClient from './mocks/http_fake_mock.js'

/**
 * Caractérisation du flux deposit (Lot 2, Phase 0).
 *
 * Fige le comportement ACTUEL : transaction PENDING sans mouvement de wallet, payload du job
 * async (providers non-sync) OU appel sync_checkout (providers sync : wave/orange), réponse API.
 * Le HTTP vers aiglehub est substitué (fake), la queue est en capture.
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

  test('provider async (moov) : transaction PENDING, aucun mouvement wallet, job dispatché', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    const fake = QueueManager.fake()

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

      // Job d'initiation dispatché avec le bon payload
      fake.assertPushed(InitiateDepositJob, {
        payload: (p: any) =>
          p.transactionReference === tx.reference &&
          p.amount === 5000 &&
          p.operator === 'moov' &&
          p.phone === '0700000005' &&
          p.paymentId === pay.id,
      })
    } finally {
      QueueManager.restore()
    }
  })

  test('provider sync (orange) : sync_checkout appelé, redirectUrl retourné', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000, phone: '2250700000006' })

    const fakeHttp = new FakeHttpClient()
    fakeHttp.simulateSuccess({
      payment_details: { redirect_url: 'https://pay.aigle/redirect', type: 'orange' },
    })
    app.container.swap(HttpClient, () => fakeHttp as any)

    try {
      const useCase = await app.container.make(DepositUseCase)
      const result = await useCase.execute(
        buildDto({ provider_code: 'orange', provider_id: 6, phone: '0700000007' }),
        user
      )

      assert.equal(result.data.status, TransactionStatus.PENDING)
      assert.equal(result.data.redirectUrl, 'https://pay.aigle/redirect')
      assert.equal(result.data.type, 'orange')

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
    } finally {
      app.container.restore(HttpClient)
    }
  })
})
