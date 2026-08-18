import { test } from '@japa/runner'
import ResetSecurityCountersOnSuccess from '#core/money/risk/application/listeners/reset_security_counters_on_success'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import InMemoryTransactionThrottleCache from '#tests/fakes/risk/in_memory_transaction_throttle_cache'
import InMemoryTransactionFailureCache from '#tests/fakes/risk/in_memory_transaction_failure_cache'
import { walletToWalletCompleted } from '#tests/factories/wallet_to_wallet_event_factory'

/**
 * Caractérise qui voit ses compteurs anti-abus remis à zéro sur un mouvement abouti.
 *
 * Le délai d'une minute entre deux opérations est vérifié sur celui qui les lance. Horodater le
 * bénéficiaire d'un transfert lui interdisait de transférer à son tour pendant une minute.
 */

function build() {
  const throttleCache = new InMemoryTransactionThrottleCache()
  const failureCache = new InMemoryTransactionFailureCache()

  return {
    listener: new ResetSecurityCountersOnSuccess(throttleCache, failureCache),
    throttleCache,
    failureCache,
  }
}

test.group('ResetSecurityCountersOnSuccess | qui est horodaté', () => {
  test('transfert p2p → seul l’émetteur est horodaté, le bénéficiaire reste libre', async ({
    assert,
  }) => {
    const { listener, throttleCache } = build()

    await listener.handle(
      walletToWalletCompleted({
        sender: { accountId: 'user-emetteur' },
        recipient: { accountId: 'user-beneficiaire' },
        type: 'p2p',
      })
    )

    assert.deepEqual(throttleCache.stamped, ['user-emetteur'])
  })

  test('transfert p2p → le compteur d’échecs du bénéficiaire n’est pas touché', async ({
    assert,
  }) => {
    const { listener, failureCache } = build()

    await listener.handle(
      walletToWalletCompleted({
        sender: { accountId: 'user-emetteur' },
        recipient: { accountId: 'user-beneficiaire' },
        type: 'p2p',
      })
    )

    assert.deepEqual(failureCache.cleared, ['user-emetteur'])
  })

  test('paiement marchand → seul le payeur est horodaté', async ({ assert }) => {
    const { listener, throttleCache } = build()

    await listener.handle(
      walletToWalletCompleted({
        sender: { accountId: 'user-payeur' },
        recipient: { accountId: 'org-42' },
        type: 'merchant',
      })
    )

    assert.deepEqual(throttleCache.stamped, ['user-payeur'])
  })

  test('dépôt → le bénéficiaire est horodaté, c’est lui qui l’a demandé', async ({ assert }) => {
    const { listener, throttleCache } = build()

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

    assert.deepEqual(throttleCache.stamped, ['user-1'])
  })

  test('encaissement marchand → personne n’est horodaté', async ({ assert }) => {
    const { listener, throttleCache } = build()

    await listener.handle(
      new DepositTransactionCompleted({
        reference: 'chk-1',
        type: 'checkout',
        amount: 9000,
        accountId: 'org-42',
      })
    )

    assert.lengthOf(throttleCache.stamped, 0)
  })
})
