import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import DepositUseCase from '#features/operations/application/use_cases/deposit.usecase'
import TransfertUseCase from '#features/operations/application/use_cases/transfert.usecase'
import InterTransfertUseCase from '#features/operations/application/use_cases/transfert_inter.usecase'
import { DepositRequestDto } from '#features/operations/application/dtos/deposit.dto'
import { TransfertRequestDto } from '#features/operations/application/dtos/transfert.dto'
import { InterTransfertRequestDto } from '#features/operations/application/dtos/transfert_inter.dto'
import { Hub2WebhookNormalizer } from '#features/webhooks/application/normalizers/hub2_webhook_normalizer'
import { WaveWebhookNormalizer } from '#features/webhooks/application/normalizers/wave_webhook_normalizer'
import SettleProviderWebhookUseCase from '#features/webhooks/application/use_cases/settle_provider_webhook.use_case'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'

/**
 * Réception directe des webhooks provider (Lot 3b-1) — normalizer + settler → engine.settle.
 *
 * Vérifie que le chemin de réception directe (Hub2/Wave normalisé → SettleProviderWebhook →
 * engine.settle) produit les MÊMES états que le settlement via aiglehub (caractérisé ailleurs) :
 * le kind est déduit du type de transaction + checkout/payout. Queue en capture ; global trx.
 */

function depositDto(): DepositRequestDto {
  return DepositRequestDto.fromRequest(
    {
      amount: 5000,
      service_type: 'deposit',
      provider_code: 'moov',
      provider_id: 7,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: '0700000005',
    },
    { fingerprintHash: 'fp', deviceUid: 'dev', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function transfertDto(): TransfertRequestDto {
  return TransfertRequestDto.fromRequest(
    {
      amount: 5000,
      service_type: 'transfert',
      provider_code: 'orange',
      provider_id: 6,
      payment_method_code: 'mobile-money',
      payment_method_id: 4,
      phone: '0700000008',
      pincode: '1234',
      include_fees: false,
    } as any,
    { fingerprintHash: 'fp', deviceUid: 'dev', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function interDto(): InterTransfertRequestDto {
  return InterTransfertRequestDto.fromRequest(
    {
      amount: 5000,
      service_type: 'inter_reseau',
      include_fees: false,
      debitaire: {
        provider_id: 7,
        provider_code: 'moov',
        phone: '0700000009',
        payment_method_code: 'mobile-money',
        payment_method_id: 4,
        pincode: '1234',
      },
      beneficiaire: {
        provider_id: 6,
        provider_code: 'orange',
        phone: '0700000010',
        payment_method_code: 'mobile-money',
        payment_method_id: 4,
      },
    } as any,
    { fingerprintHash: 'fp', deviceUid: 'dev', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

test.group('Réception directe webhooks provider | Lot 3b', (group) => {
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

  test('normalizer Hub2 : mappe type/data → ProviderWebhookEvent', ({ assert }) => {
    const checkout = Hub2WebhookNormalizer.normalize('payment_intent.succeeded', {
      purchaseReference: 'ref-1',
      id: 'op-1',
    })
    assert.deepEqual(checkout, {
      reference: 'ref-1',
      outcome: 'success',
      operationType: 'checkout',
      providerName: 'hub2',
      providerReference: 'op-1',
      errorMessage: null,
      rawData: { purchaseReference: 'ref-1', id: 'op-1' },
    })

    const payoutFail = Hub2WebhookNormalizer.normalize('transfer.failed', {
      reference: 'ref-2',
      failureCause: { message: 'boom' },
    })
    assert.equal(payoutFail?.operationType, 'payout')
    assert.equal(payoutFail?.outcome, 'failed')
    assert.equal(payoutFail?.errorMessage, 'boom')

    assert.isNull(Hub2WebhookNormalizer.normalize('unknown.type', {}))
  })

  test('normalizer Wave : client_reference → reference', ({ assert }) => {
    const ev = WaveWebhookNormalizer.normalize('checkout.session.completed', {
      client_reference: 'ref-w',
      id: 'wid',
    })
    assert.equal(ev?.reference, 'ref-w')
    assert.equal(ev?.operationType, 'checkout')
    assert.equal(ev?.outcome, 'success')
  })

  test('deposit : webhook Hub2 checkout succès → wallet crédité, tx SUCCESS', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()
    try {
      const init = await app.container.make(DepositUseCase)
      await init.execute(depositDto(), user)
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()

      const event = Hub2WebhookNormalizer.normalize('payment_intent.succeeded', {
        purchaseReference: tx.reference,
        id: 'op-dep',
      })!
      const settler = await app.container.make(SettleProviderWebhookUseCase)
      await settler.handle(event)

      assert.equal(await reloadBalance(wallet.id), 14850)
      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.SUCCESS)
    } finally {
      QueueManager.restore()
    }
  })

  test('transfert : webhook Hub2 payout échec → refund, payment FAILED', async ({ assert }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()
    try {
      const init = await app.container.make(TransfertUseCase)
      await init.execute(transfertDto(), user)
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(await reloadBalance(wallet.id), 5000)

      const event = Hub2WebhookNormalizer.normalize('transfer.failed', {
        reference: tx.reference,
        failureCause: { message: 'nope' },
      })!
      const settler = await app.container.make(SettleProviderWebhookUseCase)
      await settler.handle(event)

      assert.equal(await reloadBalance(wallet.id), 9900)
      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.FAILED)
    } finally {
      QueueManager.restore()
    }
  })

  test('inter : webhook checkout (jambe 1) → transfert_inter_first, tx PENDING', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()
    try {
      const init = await app.container.make(InterTransfertUseCase)
      await init.execute(interDto(), user)
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()

      const event = Hub2WebhookNormalizer.normalize('payment_intent.succeeded', {
        purchaseReference: tx.reference,
        id: 'op-inter1',
      })!
      const settler = await app.container.make(SettleProviderWebhookUseCase)
      await settler.handle(event)

      const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
      assert.equal(payments[0].status, PaymentStatus.SUCCESS)
      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.PENDING)
    } finally {
      QueueManager.restore()
    }
  })

  test('inter : webhook payout (jambe 2) après jambe 1 → transfert_inter_second, tx SUCCESS', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()
    try {
      const init = await app.container.make(InterTransfertUseCase)
      await init.execute(interDto(), user)
      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      const settler = await app.container.make(SettleProviderWebhookUseCase)

      await settler.handle(
        Hub2WebhookNormalizer.normalize('payment_intent.succeeded', {
          purchaseReference: tx.reference,
          id: 'op-i1',
        })!
      )
      await settler.handle(
        Hub2WebhookNormalizer.normalize('transfer.succeeded', {
          reference: tx.reference,
          id: 'op-i2',
        })!
      )

      const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
      assert.equal(payments[1].status, PaymentStatus.SUCCESS)
      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.SUCCESS)
    } finally {
      QueueManager.restore()
    }
  })
})
