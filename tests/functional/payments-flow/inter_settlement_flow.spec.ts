import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import InterTransfertUseCase from '#features/operations/application/use_cases/transfert_inter.usecase'
import { InterTransfertRequestDto } from '#features/operations/application/dtos/transfert_inter.dto'
import HandleTransfertInterFirstWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_first_webhook.use_case'
import HandleTransfertInterSecondWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_second_webhook.use_case'
import type { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import {
  createUserWithWallet,
  swapGuards,
  swapProviderGateway,
} from './mocks/operations_fixtures.js'

/**
 * Caractérisation du SETTLEMENT inter-réseau (Lot 3) — saga 2 jambes, routage LOCAL.
 *
 * - jambe 1 succès : firstPayment SUCCESS, tx encore PENDING, jambe 2 INITIÉE via provider_gateway
 *   (payout) ;
 * - jambe 1 échec  : tx FAILED + 2 payments FAILED, jambe 2 non initiée ;
 * - jambe 2 succès : secondPayment SUCCESS, tx SUCCESS ;
 * - jambe 2 échec  : secondPayment FAILED, tx FAILED.
 * Aucun mouvement wallet (Aigle en pont). Le fake ProviderResolver capture les initiations ;
 * QueueManager en capture pour DispatchWebhookEventJob.
 */

function buildInterDto(): InterTransfertRequestDto {
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
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function buildWebhook(reference: string, status: 'succeeded' | 'failed'): WebhookRequestDto {
  const now = new Date().toISOString()
  return {
    type: status === 'succeeded' ? 'checkout_succeeded' : 'checkout_failed',
    data: {
      createdAt: now,
      updatedAt: now,
      amount: 5000,
      currency: 'XOF',
      status,
      transactionId: `op-${reference}`,
      operationType: 'mobile_money',
      actionType: 'deposit',
      paymentDetails: {},
      reference,
    },
  }
}

async function initInter(user: any): Promise<Transaction> {
  const useCase = await app.container.make(InterTransfertUseCase)
  await useCase.execute(buildInterDto(), user)
  return Transaction.query().where('users_uid', user.usersUid).firstOrFail()
}

test.group('Settlement inter-réseau | caractérisation', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    QueueManager.fake()
    return async () => {
      QueueManager.restore()
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('jambe 1 succès : firstPayment SUCCESS, tx encore PENDING, jambe 2 initiée (payout)', async ({
    assert,
  }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const tx = await initInter(user)

    const first = await app.container.make(HandleTransfertInterFirstWebhookUseCase)
    await first.execute(buildWebhook(tx.reference, 'succeeded'), TransactionStatus.SUCCESS)

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[0].status, PaymentStatus.SUCCESS)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.PENDING)

    // initiation jambe 1 (checkout) puis jambe 2 (payout) → 2 invocations provider_gateway
    const operations = gateway.resolver.invokes.map((i) => i.operation)
    assert.deepEqual(operations, ['checkout', 'payout'])
  })

  test('jambe 1 échec : tx FAILED + 2 payments FAILED, jambe 2 non initiée', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const tx = await initInter(user)

    const first = await app.container.make(HandleTransfertInterFirstWebhookUseCase)
    await first.execute(buildWebhook(tx.reference, 'failed'), TransactionStatus.FAILED)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.FAILED)

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[0].status, PaymentStatus.FAILED)
    assert.equal(payments[1].status, PaymentStatus.FAILED)

    // seule l'initiation jambe 1 (checkout) a eu lieu, pas de payout jambe 2
    const operations = gateway.resolver.invokes.map((i) => i.operation)
    assert.deepEqual(operations, ['checkout'])
  })

  test('jambe 2 succès : secondPayment SUCCESS, tx SUCCESS', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const tx = await initInter(user)

    const first = await app.container.make(HandleTransfertInterFirstWebhookUseCase)
    await first.execute(buildWebhook(tx.reference, 'succeeded'), TransactionStatus.SUCCESS)

    const second = await app.container.make(HandleTransfertInterSecondWebhookUseCase)
    await second.execute(buildWebhook(tx.reference, 'succeeded'), TransactionStatus.SUCCESS)

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[1].status, PaymentStatus.SUCCESS)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.SUCCESS)
  })

  test('jambe 2 échec : secondPayment FAILED, tx FAILED', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const tx = await initInter(user)

    const first = await app.container.make(HandleTransfertInterFirstWebhookUseCase)
    await first.execute(buildWebhook(tx.reference, 'succeeded'), TransactionStatus.SUCCESS)

    const second = await app.container.make(HandleTransfertInterSecondWebhookUseCase)
    await second.execute(buildWebhook(tx.reference, 'failed'), TransactionStatus.FAILED)

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[1].status, PaymentStatus.FAILED)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.FAILED)
  })
})
