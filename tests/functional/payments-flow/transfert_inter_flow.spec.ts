import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { QueueManager } from '@adonisjs/queue'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import InterTransfertUseCase from '#features/operations/application/use_cases/transfert_inter.usecase'
import InitiateInterTransferJob from '#features/money_movement/infrastructure/jobs/initiate_inter_transfer_job'
import { InterTransfertRequestDto } from '#features/operations/application/dtos/transfert_inter.dto'
import { createUserWithWallet, reloadBalance, swapGuards } from './mocks/operations_fixtures.js'

/**
 * Caractérisation du flux transfert_inter (Lot 2, Phase 0) — saga 2 jambes, jambe 1 (cash-in).
 *
 * Fige le comportement ACTUEL : transaction PENDING direction EXTERNAL, 2 payments (dépôt PENDING
 * + transfert DRAFT), aucun mouvement wallet, payload du job d'initiation, réponse API.
 * La jambe 2 (webhook → second step job) est hors périmètre Lot 2.
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

  test('provider async (moov) : transaction EXTERNAL PENDING, 2 payments, aucun mouvement wallet, job dispatché', async ({
    assert,
  }) => {
    const { user, wallet } = await createUserWithWallet({ balance: 10000 })
    const fake = QueueManager.fake()

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

      // Job jambe 1 dispatché avec le bon payload (cash-in côté opérateur débiteur)
      const depositPayment = payments.find((p) => p.status === PaymentStatus.PENDING)!
      fake.assertPushed(InitiateInterTransferJob, {
        payload: (p: any) =>
          p.transactionReference === tx.reference &&
          p.amount === 5000 &&
          p.operator === 'moov' &&
          p.phone === '0700000009' &&
          p.paymentId === depositPayment.id,
      })
    } finally {
      QueueManager.restore()
    }
  })
})
