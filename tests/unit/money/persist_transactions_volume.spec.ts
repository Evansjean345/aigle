import { test } from '@japa/runner'
import PersistUserTransactionsVolume from '#core/money/transactions/application/listeners/persist_user_transactions_volume'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import InMemoryTransactionVolumeCache from '#tests/fakes/money/in_memory_transaction_volume_cache'
import InMemoryIdempotencyProvider from '#tests/fakes/money/in_memory_idempotency_provider'
import { walletToWalletCompleted } from '#tests/factories/wallet_to_wallet_event_factory'

/**
 * Caractérise la clé sous laquelle le volume engagé est compté.
 *
 * Les plafonds se lisent par compte : le volume doit monter sous la même clé, y compris pour un
 * marchand, dont le compte est l'organisation et non une personne.
 */

function build() {
  const volumeCache = new InMemoryTransactionVolumeCache()
  const listener = new PersistUserTransactionsVolume(volumeCache, new InMemoryIdempotencyProvider())

  return { listener, volumeCache }
}

test.group('PersistUserTransactionsVolume | le volume est compté par compte', () => {
  test('encaissement marchand → le volume monte sur le compte de l’organisation', async ({
    assert,
  }) => {
    const { listener, volumeCache } = build()

    await listener.handle(
      new DepositTransactionCompleted({
        reference: 'dep-checkout-1',
        type: 'checkout',
        amount: 5000,
        accountId: 'org-42',
      })
    )

    assert.deepEqual(volumeCache.increments, [{ accountId: 'org-42', amount: 5000 }])
  })

  test('transfert reçu par un marchand → le volume monte des deux côtés', async ({ assert }) => {
    const { listener, volumeCache } = build()

    await listener.handle(
      walletToWalletCompleted({
        sender: { accountId: 'user-1', amount: 7000 },
        // Bénéficiaire marchand : son compte est l'organisation.
        recipient: { accountId: 'org-9', amount: 7000 },
        type: 'merchant',
      })
    )

    assert.lengthOf(volumeCache.increments, 2)
    assert.includeDeepMembers(volumeCache.increments, [
      { accountId: 'user-1', amount: 7000 },
      { accountId: 'org-9', amount: 7000 },
    ])
  })

  test('dépôt → le volume monte sur le compte crédité', async ({ assert }) => {
    const { listener, volumeCache } = build()

    await listener.handle(
      new DepositTransactionCompleted({
        reference: 'dep-1',
        type: 'deposit',
        amount: 2000,
        accountId: 'user-1',
        userId: 'user-1',
        balanceAfter: 2000,
      })
    )

    assert.deepEqual(volumeCache.increments, [{ accountId: 'user-1', amount: 2000 }])
  })

  test('transfert p2p → le volume monte sur les deux comptes', async ({ assert }) => {
    const { listener, volumeCache } = build()

    await listener.handle(
      walletToWalletCompleted({
        sender: { accountId: 'user-1', amount: 3000 },
        recipient: { accountId: 'user-2', amount: 3000 },
        type: 'p2p',
      })
    )

    assert.lengthOf(volumeCache.increments, 2)
    assert.includeDeepMembers(volumeCache.increments, [
      { accountId: 'user-1', amount: 3000 },
      { accountId: 'user-2', amount: 3000 },
    ])
  })

  test('transfert sortant → le volume monte sur le compte émetteur', async ({ assert }) => {
    const { listener, volumeCache } = build()

    await listener.handle(
      new TransfertTransactionCompleted({
        reference: 'trf-1',
        balanceAfter: 1000,
        amount: 4000,
        accountId: 'user-1',
        userId: 'user-1',
        beneficiaryPhone: '+2250705050505',
      })
    )

    assert.deepEqual(volumeCache.increments, [{ accountId: 'user-1', amount: 4000 }])
  })

  test('payout marchand → le volume monte sur le compte de l’organisation, sans personne derrière', async ({
    assert,
  }) => {
    const { listener, volumeCache } = build()

    // Un payout part d'un compte org : aucune personne ne le porte, seul `accountId` identifie
    // le compte.
    await listener.handle(
      new TransfertTransactionCompleted({
        reference: 'pay-1',
        balanceAfter: 95000,
        amount: 5000,
        accountId: 'org-42',
        userId: null as unknown as string,
        beneficiaryPhone: '+2250705050505',
      })
    )

    assert.deepEqual(volumeCache.increments, [{ accountId: 'org-42', amount: 5000 }])
  })
})
