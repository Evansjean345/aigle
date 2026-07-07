import { test } from '@japa/runner'
import IdentityGate from '#core/identity/authentication/application/services/identity_gate'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import type User from '#core/identity/user/domain/models/user'

/**
 * Test unitaire d'IdentityGate — la façade d'autorisation du chemin argent.
 *
 * Vérifie le CÂBLAGE de sécurité par `kind` (quels checks sont appliqués/omis), la frontière par ID
 * (résolution du model User frais depuis le core, échec si introuvable), et l'agrégation (un check
 * qui échoue rejette l'autorisation). Les collaborateurs sont des espions ; aucune I/O réelle.
 */

const FAKE_USER = { id: 1, usersUid: 'user-uid-1' } as unknown as User

class SpyAccountValidation {
  devices: unknown[] = []
  pins: Array<{ user: User; pin: string }> = []
  pinResult = true
  deviceError: Error | null = null

  async validateDevice(user: User, ..._rest: unknown[]): Promise<void> {
    this.devices.push(user)
    if (this.deviceError) throw this.deviceError
  }

  async verifyPinForUser(user: User, pinCode: string): Promise<boolean> {
    this.pins.push({ user, pin: pinCode })
    return this.pinResult
  }
}

class SpyDebitPhoneValidation {
  calls: Array<{ phone: string; providerId: number }> = []
  async validateDebitPhone(phone: string, providerId: number, _user: User): Promise<void> {
    this.calls.push({ phone, providerId })
  }
}

class SpyThrottleCache {
  calls: string[] = []
  async verifyThrottle(userId: string): Promise<void> {
    this.calls.push(userId)
  }
}

class SpyFailureCache {
  calls: string[] = []
  blockedError: Error | null = null
  async verifyNotBlocked(userId: string): Promise<void> {
    this.calls.push(userId)
    if (this.blockedError) throw this.blockedError
  }
}

class StubUserRepository {
  user: User | null = FAKE_USER
  lookups: string[] = []
  async findById(id: string): Promise<User | null> {
    this.lookups.push(id)
    return this.user
  }
}

function build() {
  const account = new SpyAccountValidation()
  const debit = new SpyDebitPhoneValidation()
  const throttle = new SpyThrottleCache()
  const failure = new SpyFailureCache()
  const users = new StubUserRepository()
  const gate = new IdentityGate(
    account as any,
    debit as any,
    users as any,
    throttle as any,
    failure as any
  )
  return { gate, account, debit, throttle, failure, users }
}

test.group('IdentityGate | frontière par ID', () => {
  test('résout le model User frais depuis le core via userId', async ({ assert }) => {
    const { gate, users } = build()
    await gate.authorize({ userId: 'user-uid-1', kind: 'deposit' })
    assert.deepEqual(users.lookups, ['user-uid-1'])
  })

  test('utilisateur introuvable → UserAccountNotFoundException, aucun check exécuté', async ({
    assert,
  }) => {
    const { gate, users, failure, account } = build()
    users.user = null

    await assert.rejects(
      () => gate.authorize({ userId: 'ghost', kind: 'transfert', pincode: '1234' }),
      UserAccountNotFoundException.message ?? undefined
    )
    assert.lengthOf(failure.calls, 0)
    assert.lengthOf(account.pins, 0)
  })
})

test.group('IdentityGate | câblage des checks par kind', () => {
  test('deposit : bloqué + device + debitPhone ; PAS throttle ni PIN', async ({ assert }) => {
    const { gate, account, debit, throttle, failure } = build()

    await gate.authorize({
      userId: 'user-uid-1',
      kind: 'deposit',
      debitPhone: { phone: '0700000005', providerId: 7 },
    })

    assert.deepEqual(failure.calls, ['user-uid-1']) // pas bloqué
    assert.lengthOf(account.devices, 1) // device
    assert.lengthOf(debit.calls, 1) // source débitrice
    assert.lengthOf(throttle.calls, 0) // pas de vélocité sur deposit
    assert.lengthOf(account.pins, 0) // pas de step-up PIN
  })

  test('transfert : bloqué + device + throttle + PIN ; PAS debitPhone', async ({ assert }) => {
    const { gate, account, debit, throttle, failure } = build()

    await gate.authorize({ userId: 'user-uid-1', kind: 'transfert', pincode: '1234' })

    assert.deepEqual(failure.calls, ['user-uid-1'])
    assert.lengthOf(account.devices, 1)
    assert.deepEqual(throttle.calls, ['user-uid-1']) // vélocité
    assert.lengthOf(account.pins, 1) // step-up PIN
    assert.equal(account.pins[0].pin, '1234')
    assert.lengthOf(debit.calls, 0) // pas de debit-phone
  })

  test('transfert_inter : bloqué + device + throttle + debitPhone ; PAS PIN', async ({
    assert,
  }) => {
    const { gate, account, debit, throttle } = build()

    await gate.authorize({
      userId: 'user-uid-1',
      kind: 'transfert_inter',
      debitPhone: { phone: '0700000009', providerId: 7 },
    })

    assert.lengthOf(throttle.calls, 1)
    assert.lengthOf(debit.calls, 1)
    assert.lengthOf(account.pins, 0)
  })

  test('wallet_to_wallet : bloqué + device + throttle + PIN ; PAS debitPhone', async ({
    assert,
  }) => {
    const { gate, account, debit, throttle } = build()

    await gate.authorize({ userId: 'user-uid-1', kind: 'wallet_to_wallet', pincode: '9999' })

    assert.lengthOf(throttle.calls, 1)
    assert.lengthOf(account.pins, 1)
    assert.lengthOf(debit.calls, 0)
  })

  test('deposit sans debitPhone : la garde source débitrice est omise', async ({ assert }) => {
    const { gate, debit } = build()
    await gate.authorize({ userId: 'user-uid-1', kind: 'deposit' })
    assert.lengthOf(debit.calls, 0)
  })
})

test.group('IdentityGate | agrégation des échecs', () => {
  test('un check qui échoue (compte bloqué) rejette l’autorisation', async ({ assert }) => {
    const { gate, failure } = build()
    failure.blockedError = new Error('compte bloqué')

    await assert.rejects(
      () => gate.authorize({ userId: 'user-uid-1', kind: 'deposit' }),
      'compte bloqué'
    )
  })
})
