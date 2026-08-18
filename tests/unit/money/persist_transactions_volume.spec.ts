import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import PersistUserTransactionsVolume from '#core/money/transactions/application/listeners/persist_user_transactions_volume'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import WalletToWalletTransactionCompleted, {
  type WalletToWalletLeg,
} from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import type TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import type IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'

/**
 * Caractérise `PersistUserTransactionsVolume` **account-centric** : le volume (plafonds daily/monthly)
 * est incrémenté **par compte** (`accountId`), y compris pour un **marchand** (compte org sans user).
 * Reproduit le bug « les volumes marchands ne montent jamais » (le chemin d'écriture sautait les
 * comptes org alors que la lecture/validation lit par `accountId`). Testé avec des stubs des
 * frontières (cache de volume + idempotence), sans Redis.
 */

interface IncrCall {
  key: string
  amount: number
}

function build() {
  const calls: IncrCall[] = []
  const cache = {
    incrementOnSuccess: async (p: { accountId: string; amount: number }) => {
      calls.push({ key: p.accountId, amount: p.amount })
    },
  } as unknown as TransactionVolumeCache

  const idempotency = {
    checkAndMark: async () => true,
  } as unknown as IdempotencyProvider

  const listener = new PersistUserTransactionsVolume(cache, idempotency)
  return { listener, calls }
}

/** Jambe de l'event — le modèle `Transaction` ne traverse plus la frontière. */
function leg(overrides: Partial<WalletToWalletLeg>): WalletToWalletLeg {
  return {
    reference: 'ref',
    accountId: 'acc',
    amount: 1000,
    occurredAt: DateTime.now(),
    balanceAfter: 0,
    phone: null,
    ...overrides,
  }
}

test.group('PersistUserTransactionsVolume | account-centric', () => {
  test('encaissement marchand (checkout) → incrémente le volume du compte org (accountId)', async ({
    assert,
  }) => {
    const { listener, calls } = build()

    await listener.handle(
      new DepositTransactionCompleted({
        reference: 'dep-checkout-1',
        type: 'checkout',
        amount: 5000,
        accountId: 'org-42',
      })
    )

    assert.deepEqual(calls, [{ key: 'org-42', amount: 5000 }])
  })

  test('transfert wallet-to-wallet reçu par un marchand → incrémente le compte bénéficiaire', async ({
    assert,
  }) => {
    const { listener, calls } = build()

    await listener.handle(
      new WalletToWalletTransactionCompleted({
        sender: leg({ reference: 's-1', accountId: 'user-1', amount: 7000 }),
        // Bénéficiaire marchand : son compte est l'organisation.
        recipient: leg({ reference: 'r-1', accountId: 'org-9', amount: 7000 }),
        type: 'merchant',
      })
    )

    assert.lengthOf(calls, 2)
    assert.includeDeepMembers(calls, [
      { key: 'user-1', amount: 7000 },
      { key: 'org-9', amount: 7000 },
    ])
  })

  test('dépôt consumer → incrémente par accountId (== usersUid)', async ({ assert }) => {
    const { listener, calls } = build()

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

    assert.deepEqual(calls, [{ key: 'user-1', amount: 2000 }])
  })

  test('transfert p2p → incrémente émetteur ET bénéficiaire par accountId', async ({ assert }) => {
    const { listener, calls } = build()

    await listener.handle(
      new WalletToWalletTransactionCompleted({
        sender: leg({ reference: 's-2', accountId: 'user-1', amount: 3000 }),
        recipient: leg({ reference: 'r-2', accountId: 'user-2', amount: 3000 }),
        type: 'p2p',
      })
    )

    assert.lengthOf(calls, 2)
    assert.includeDeepMembers(calls, [
      { key: 'user-1', amount: 3000 },
      { key: 'user-2', amount: 3000 },
    ])
  })

  test('transfert consumer sortant → incrémente par le compte émetteur (accountId == user)', async ({
    assert,
  }) => {
    const { listener, calls } = build()

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

    assert.deepEqual(calls, [{ key: 'user-1', amount: 4000 }])
  })

  test('payout marchand sortant → incrémente le compte ORG (accountId, sans user)', async ({
    assert,
  }) => {
    const { listener, calls } = build()

    // Payout : un external_out depuis un compte org — la transaction n'a PAS de user
    // (`userId` null), seule la clé `accountId` (l'org) identifie le compte.
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

    assert.deepEqual(calls, [{ key: 'org-42', amount: 5000 }])
  })
})
