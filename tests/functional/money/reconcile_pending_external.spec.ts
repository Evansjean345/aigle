import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Payment from '#core/money/transactions/domain/models/payment'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import { ProviderRegistry } from '#core/money/provider_gateway/infrastructure/provider_registry'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import ReconcilePendingExternalHandler from '#core/money/money_movement/application/services/movements/settlement/reconcile_pending_external_handler'
import type { SettleCommand } from '#core/money/money_movement/domain/types/money_movement_types'
import type { ProviderPollResult } from '#core/money/provider_gateway/domain/types/provider_poll'

/**
 * B6 — Réconciliation générique des mouvements externes orphelins.
 *
 * Money-critique : un webhook perdu laisse une transaction `PENDING` et des fonds immobilisés. Ce
 * balayage va chercher le verdict chez l'opérateur — mais **ne doit jamais deviner** : seuls les
 * statuts explicitement terminaux déclenchent un règlement.
 *
 * Le test cible le **use case** (déterministe) : engine et provider sont doublés, on vérifie la
 * SÉLECTION (qui est candidat) et la DÉCISION (régler ou non, avec quel verdict). La mécanique
 * argent de `settle` est couverte par ailleurs (B5 / settlement flow).
 */

const AGGREGATOR = 'faketest'

/** Provider doublé : `pollStatus` renvoie ce qu'on lui dicte. */
class FakePollProvider {
  readonly providerName = AGGREGATOR

  polled: string[] = []
  next: ProviderPollResult = { outcome: 'pending' }

  async checkout() {
    throw new Error('non utilisé')
  }
  async payout() {
    throw new Error('non utilisé')
  }
  async pollStatus(_operation: string, providerReference: string): Promise<ProviderPollResult> {
    this.polled.push(providerReference)
    return this.next
  }
}

/** Engine doublé : capture les règlements demandés sans toucher à l'argent. */
class FakeEngine {
  settled: SettleCommand[] = []

  async settle(cmd: SettleCommand) {
    this.settled.push(cmd)

    return {
      reference: cmd.reference,
      movementId: '1',
      status: TransactionStatus.SUCCESS,
      alreadySettled: false,
    }
  }
}

/**
 * Monte un mouvement externe orphelin : transaction PENDING + paiement interrogeable, dont
 * l'horloge ('updated_at') est **reculée** pour le rendre candidat (le seuil est de 20 min).
 */
async function makeOrphanMovement(
  stalledMinutes: number
): Promise<{ tx: Transaction; payment: Payment }> {
  const tx = new Transaction()
  tx.transactionsUid = randomUUID()
  tx.accountId = randomUUID()
  tx.amount = 10000
  tx.totalAmount = 10000
  tx.fees = 0
  tx.operationType = TransactionType.TRANSFERT
  tx.direction = TransactionDirection.DEBIT
  tx.reference = `tx_${randomUUID().slice(0, 12)}`
  tx.dateTransaction = new Date().toISOString()
  tx.status = TransactionStatus.PENDING
  await tx.save()

  const payment = new Payment()
  payment.transactionsId = tx.id
  payment.transactionsUid = tx.transactionsUid!
  payment.paymentMethod = 'mobile-money'
  payment.operationType = TransactionType.TRANSFERT
  payment.step = PaymentStep.TRANSFERT_INIT
  payment.providerReference = `prov_${randomUUID().slice(0, 8)}`
  payment.aggregator = AGGREGATOR
  await payment.save()

  // `updated_at` est auto-géré par Lucid → on recule l'horloge en SQL brut.
  await db.rawQuery(
    'UPDATE payments SET updated_at = DATE_SUB(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
    [stalledMinutes, payment.id]
  )

  return { tx, payment }
}

test.group('Money | réconciliation des mouvements externes orphelins — B6', (group) => {
  let provider: FakePollProvider
  let engine: FakeEngine

  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()

    provider = new FakePollProvider()
    engine = new FakeEngine()

    const registry = await app.container.make(ProviderRegistry)
    registry.register(provider as any)

    app.container.swap(MoneyMovementEngine, () => engine as any)

    return async () => {
      app.container.restore(MoneyMovementEngine)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('statut terminal succeeded → settle success (webhook manquant rattrapé)', async ({
    assert,
  }) => {
    const { tx, payment } = await makeOrphanMovement(60)
    provider.next = { outcome: 'succeeded', rawData: { status: 'succeeded' } }

    const useCase = await app.container.make(ReconcilePendingExternalHandler)
    const result = await useCase.handle()

    // Le bon mouvement a été interrogé, avec la référence provider.
    assert.include(provider.polled, payment.providerReference!)

    const settled = engine.settled.find((c) => c.reference === tx.reference)
    assert.isDefined(settled)
    assert.equal(settled!.outcome, 'success')
    assert.equal(settled!.kind, 'transfert')
    assert.isAtLeast(result.settled, 1)
  })

  test('statut terminal failed → settle failure (release/refund déclenché)', async ({ assert }) => {
    const { tx } = await makeOrphanMovement(60)
    provider.next = { outcome: 'failed', errorCode: 'HARD', errorMessage: 'numéro invalide' }

    const useCase = await app.container.make(ReconcilePendingExternalHandler)
    await useCase.handle()

    const settled = engine.settled.find((c) => c.reference === tx.reference)
    assert.isDefined(settled)
    assert.equal(settled!.outcome, 'failure')
  })

  test('toujours en cours → laissé intact, AUCUN règlement', async ({ assert }) => {
    const { tx } = await makeOrphanMovement(60)
    provider.next = { outcome: 'pending' }

    const useCase = await app.container.make(ReconcilePendingExternalHandler)
    await useCase.handle()

    assert.isUndefined(engine.settled.find((c) => c.reference === tx.reference))
  })

  test('statut indéterminé → JAMAIS de règlement deviné (revue manuelle)', async ({ assert }) => {
    const { tx } = await makeOrphanMovement(60)
    provider.next = { outcome: 'unknown', errorCode: 'NOT_FOUND' }

    const useCase = await app.container.make(ReconcilePendingExternalHandler)
    await useCase.handle()

    // Invariant monétaire : un statut ambigu ne doit provoquer ni crédit ni remboursement.
    assert.isUndefined(engine.settled.find((c) => c.reference === tx.reference))
  })

  test('mouvement récent (sous le seuil) → pas encore candidat, non interrogé', async ({
    assert,
  }) => {
    const { payment } = await makeOrphanMovement(2)
    provider.next = { outcome: 'succeeded' }

    const useCase = await app.container.make(ReconcilePendingExternalHandler)
    await useCase.handle()

    assert.notInclude(provider.polled, payment.providerReference!)
  })
})
