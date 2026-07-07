import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import InterTransfertUseCase from '#aiglesend/operations/application/use_cases/transfert_inter.usecase'
import { InterTransfertRequestDto } from '#aiglesend/operations/application/dtos/transfert_inter.dto'
import { Hub2WebhookNormalizer } from '#core/money/webhooks/application/normalizers/hub2_webhook_normalizer'
import SettleProviderWebhookUseCase from '#core/money/webhooks/application/use_cases/settle_provider_webhook.use_case'
import {
  createUserWithWallet,
  swapGuards,
  swapProviderGateway,
} from './mocks/operations_fixtures.js'

/**
 * Caractérisation du SETTLEMENT inter-réseau via la RÉCEPTION DIRECTE des webhooks provider (Lot 3b).
 * Saga 2 jambes : jambe 1 = checkout (cash-in débiteur), jambe 2 = payout (cash-out bénéficiaire).
 *
 * - jambe 1 succès : firstPayment SUCCESS, tx encore PENDING, jambe 2 INITIÉE via provider_gateway ;
 * - jambe 1 échec  : tx FAILED + 2 payments FAILED, jambe 2 non initiée ;
 * - jambe 2 succès : secondPayment SUCCESS, tx SUCCESS ;
 * - jambe 2 échec  : secondPayment FAILED, tx FAILED.
 * Aucun mouvement wallet (Aigle en pont). provider_gateway faké ; QueueManager en capture.
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

/** Webhook Hub2 checkout (jambe 1, cash-in) normalisé. */
function checkoutWebhook(reference: string, ok: boolean) {
  return Hub2WebhookNormalizer.normalize(
    ok ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
    { purchaseReference: reference, id: `op-${reference}`, lastPaymentFailure: { message: 'KO' } }
  )!
}

/** Webhook Hub2 transfer/payout (jambe 2, cash-out) normalisé. */
function payoutWebhook(reference: string, ok: boolean) {
  return Hub2WebhookNormalizer.normalize(ok ? 'transfer.succeeded' : 'transfer.failed', {
    reference,
    id: `op-${reference}`,
    failureCause: { message: 'KO' },
  })!
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

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(checkoutWebhook(tx.reference, true))

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

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(checkoutWebhook(tx.reference, false))

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

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(checkoutWebhook(tx.reference, true))
    await settler.handle(payoutWebhook(tx.reference, true))

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[1].status, PaymentStatus.SUCCESS)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.SUCCESS)
  })

  test('jambe 2 échec : secondPayment FAILED, tx FAILED', async ({ assert }) => {
    const { user } = await createUserWithWallet({ balance: 10000 })
    const tx = await initInter(user)

    const settler = await app.container.make(SettleProviderWebhookUseCase)
    await settler.handle(checkoutWebhook(tx.reference, true))
    await settler.handle(payoutWebhook(tx.reference, false))

    const payments = await Payment.query().where('transactions_id', tx.id).orderBy('id', 'asc')
    assert.equal(payments[1].status, PaymentStatus.FAILED)

    await tx.refresh()
    assert.equal(tx.status, TransactionStatus.FAILED)
  })
})
