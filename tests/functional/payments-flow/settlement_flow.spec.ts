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
import { DepositRequestDto } from '#features/operations/application/dtos/deposit.dto'
import { TransfertRequestDto } from '#features/operations/application/dtos/transfert.dto'
import HandleDepositWebhookUseCase from '#features/webhooks/application/use_cases/handle_deposit_webhook.use_case'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import type { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import {
  createUserWithWallet,
  reloadBalance,
  swapGuards,
  swapProviderGateway,
} from '#tests/functional/payments-flow/mocks/operations_fixtures'

/**
 * Caractérisation du SETTLEMENT (Lot 3, Phase 0).
 *
 * Fige le comportement ACTUEL de la boucle de retour (webhooks aiglehub) AVANT de la ramener
 * derrière l'engine : deposit succès (crédit wallet + tx/payment SUCCESS), deposit échec
 * (tx/payment FAILED, wallet inchangé), transfert succès (statuts SUCCESS, wallet inchangé),
 * transfert échec (FAILED + refund `totalAmount` — NB : le fee n'est pas re-crédité).
 *
 * Montage : on initie via le VRAI use case produit (crée la transaction PENDING + payment,
 * mouvemente le wallet comme en prod), puis on invoque le VRAI handler de webhook. Queue en
 * capture (le job de dispatch d'event n'exécute pas les listeners). Isolation DB = global trx.
 */

function buildDepositDto(): DepositRequestDto {
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
    { fingerprintHash: 'fp-test', deviceUid: 'dev-test', platform: 'android' } as any,
    { ip: '127.0.0.1', countryCode: 'CI', city: 'Abidjan', isVpn: false } as any
  )
}

function buildTransfertDto(): TransfertRequestDto {
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

test.group('Settlement | caractérisation', (group) => {
  let restoreGuards: () => void
  let gateway: ReturnType<typeof swapProviderGateway>

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    restoreGuards = swapGuards()
    gateway = swapProviderGateway()
    return async () => {
      gateway.restore()
      restoreGuards()
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('deposit succès : wallet crédité du totalAmount, tx + payment SUCCESS', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()

    try {
      const initUseCase = await app.container.make(DepositUseCase)
      await initUseCase.execute(buildDepositDto(), user)

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(tx.status, TransactionStatus.PENDING)
      assert.equal(await reloadBalance(wallet.id), 10000)

      const webhookUseCase = await app.container.make(HandleDepositWebhookUseCase)
      const response = await webhookUseCase.execute(
        buildWebhook(tx.reference, 'succeeded'),
        TransactionStatus.SUCCESS
      )

      assert.equal(response.status, 200)

      // Wallet crédité du totalAmount (5000 - 150 = 4850) → 14850
      assert.equal(await reloadBalance(wallet.id), 14850)

      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.SUCCESS)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.SUCCESS)
    } finally {
      QueueManager.restore()
    }
  })

  test('deposit échec : tx + payment FAILED, wallet inchangé', async ({ assert }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()

    try {
      const initUseCase = await app.container.make(DepositUseCase)
      await initUseCase.execute(buildDepositDto(), user)

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()

      const webhookUseCase = await app.container.make(HandleDepositWebhookUseCase)
      await webhookUseCase.execute(buildWebhook(tx.reference, 'failed'), TransactionStatus.FAILED)

      assert.equal(await reloadBalance(wallet.id), 10000)

      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.FAILED)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.FAILED)
    } finally {
      QueueManager.restore()
    }
  })

  test('transfert succès : tx + payment SUCCESS, wallet inchangé (déjà débité)', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()

    try {
      const initUseCase = await app.container.make(TransfertUseCase)
      await initUseCase.execute(buildTransfertDto(), user)

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      // Débit immédiat à l'initiation : 10000 - 5000 = 5000
      assert.equal(await reloadBalance(wallet.id), 5000)

      const webhookUseCase = await app.container.make(HandleTransfertWebhookUseCase)
      await webhookUseCase.execute(
        buildWebhook(tx.reference, 'succeeded'),
        TransactionStatus.SUCCESS
      )

      // Succès : aucun mouvement wallet supplémentaire
      assert.equal(await reloadBalance(wallet.id), 5000)

      await tx.refresh()
      assert.equal(tx.status, TransactionStatus.SUCCESS)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.SUCCESS)
    } finally {
      QueueManager.restore()
    }
  })

  test('transfert échec : refund du totalAmount (fee non re-crédité), wallet à 9900', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    QueueManager.fake()

    try {
      const initUseCase = await app.container.make(TransfertUseCase)
      await initUseCase.execute(buildTransfertDto(), user)

      const tx = await Transaction.query().where('users_uid', user.usersUid).firstOrFail()
      assert.equal(await reloadBalance(wallet.id), 5000)

      const webhookUseCase = await app.container.make(HandleTransfertWebhookUseCase)
      await webhookUseCase.execute(buildWebhook(tx.reference, 'failed'), TransactionStatus.FAILED)

      // Refund du totalAmount (4900) : 5000 + 4900 = 9900 (le fee de 100 n'est pas re-crédité)
      assert.equal(await reloadBalance(wallet.id), 9900)

      const pay = await Payment.query().where('transactions_id', tx.id).firstOrFail()
      assert.equal(pay.status, PaymentStatus.FAILED)
    } finally {
      QueueManager.restore()
    }
  })
})
