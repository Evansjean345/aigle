import { test } from '@japa/runner'
import PinAttemptGuard from '#core/authentication/application/services/pin_attempt_guard'
import type SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import type TimedFlag from '#shared/domain/cache/timed_flag'
import { UserStatus } from '#core/user/domain/enum'
import AccountBlockedException from '#core/authentication/infrastructure/exceptions/account_blocked_exception'
import PinTemporarilyBlockedException from '#core/authentication/infrastructure/exceptions/pin_temporarily_blocked_exception'
import type UserRepository from '#core/user/domain/interfaces/user_repository'
import type User from '#core/user/domain/models/user'

interface CounterStub {
  counter: SlidingWindowCounter
  nextCount: number
  resetCalls: string[]
  throwOnIncrement?: boolean
  throwOnReset?: boolean
}

interface FlagStub {
  flag: TimedFlag
  ttlValue: number
  setCalls: Array<{ key: string; ttl: number }>
  clearCalls: string[]
  throwOnSet?: boolean
  throwOnClear?: boolean
}

function buildCounterStub(opts: Partial<CounterStub> = {}): CounterStub {
  const stub: CounterStub = {
    counter: null as any,
    nextCount: opts.nextCount ?? 1,
    resetCalls: [],
    throwOnIncrement: opts.throwOnIncrement,
    throwOnReset: opts.throwOnReset,
  }
  stub.counter = {
    increment: async () => {
      if (stub.throwOnIncrement) throw new Error('Redis down')
      return stub.nextCount
    },
    reset: async (key: string) => {
      if (stub.throwOnReset) throw new Error('Redis down')
      stub.resetCalls.push(key)
    },
  } as unknown as SlidingWindowCounter
  return stub
}

function buildFlagStub(opts: Partial<FlagStub> = {}): FlagStub {
  const stub: FlagStub = {
    flag: null as any,
    ttlValue: opts.ttlValue ?? 0,
    setCalls: [],
    clearCalls: [],
    throwOnSet: opts.throwOnSet,
    throwOnClear: opts.throwOnClear,
  }
  stub.flag = {
    set: async (key: string, ttl: number) => {
      if (stub.throwOnSet) throw new Error('Redis down')
      stub.setCalls.push({ key, ttl })
    },
    ttl: async () => stub.ttlValue,
    clear: async (key: string) => {
      if (stub.throwOnClear) throw new Error('Redis down')
      stub.clearCalls.push(key)
    },
  } as unknown as TimedFlag
  return stub
}

function buildUserRepoStub(): { repo: UserRepository; savedUsers: User[] } {
  const savedUsers: User[] = []
  const repo = {
    save: async (user: User) => {
      savedUsers.push(user)
      return user
    },
  } as unknown as UserRepository
  return { repo, savedUsers }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 42,
    status: UserStatus.ACTIVE,
    ...overrides,
  } as unknown as User
}

function buildGuard(
  counter: SlidingWindowCounter,
  flag: TimedFlag,
  repo: UserRepository
): PinAttemptGuard {
  const guard = new PinAttemptGuard(repo, counter, flag)
  ;(guard as unknown as { revokeTokens: (user: User) => Promise<void> }).revokeTokens =
    async () => {}
  return guard
}

test.group('PinAttemptGuard | assertNotBlocked', () => {
  test('throws AccountBlockedException when user is permanently blocked', async ({ assert }) => {
    const counter = buildCounterStub()
    const flag = buildFlagStub()
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await assert.rejects(
      () => guard.assertNotBlocked(makeUser({ status: UserStatus.BLOCKED })),
      AccountBlockedException
    )
  })

  test('throws PinTemporarilyBlockedException when flag TTL is active', async ({ assert }) => {
    const counter = buildCounterStub()
    const flag = buildFlagStub({ ttlValue: 300 })
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    try {
      await guard.assertNotBlocked(makeUser())
      assert.fail('should have thrown')
    } catch (error) {
      assert.instanceOf(error, PinTemporarilyBlockedException)
      assert.equal((error as PinTemporarilyBlockedException).retryAfterSeconds, 300)
    }
  })

  test('passes through when not blocked', async ({ assert }) => {
    const counter = buildCounterStub()
    const flag = buildFlagStub()
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await assert.doesNotReject(() => guard.assertNotBlocked(makeUser()))
  })
})

test.group('PinAttemptGuard | recordFailure', () => {
  test('does nothing extra below alert threshold', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 4 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await guard.recordFailure(makeUser())

    assert.lengthOf(savedUsers, 0)
    assert.lengthOf(flag.setCalls, 0)
  })

  test('arms temporary block at palier 5 (60s)', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 5 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await guard.recordFailure(makeUser())

    assert.equal(flag.setCalls.length, 1)
    assert.equal(flag.setCalls[0].ttl, 60)
    assert.lengthOf(savedUsers, 0)
  })

  test('arms temporary block at palier 7 (900s)', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 7 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const user = makeUser()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await guard.recordFailure(user)

    assert.equal(user.status, UserStatus.ACTIVE)
    assert.equal(flag.setCalls[0].ttl, 900)
    assert.lengthOf(savedUsers, 0)
  })

  test('does not mutate status at 8 failures (1h block)', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 8 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const user = makeUser()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await guard.recordFailure(user)

    assert.equal(user.status, UserStatus.ACTIVE)
    assert.equal(flag.setCalls[0].ttl, 3600)
    assert.lengthOf(savedUsers, 0)
  })

  test('auto-blocks user at 9 failures and revokes tokens', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 9 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    let revoked = false
    const guard = new PinAttemptGuard(repo, counter.counter, flag.flag)
    ;(guard as unknown as { revokeTokens: (user: User) => Promise<void> }).revokeTokens =
      async () => {
        revoked = true
      }
    const user = makeUser()

    await guard.recordFailure(user)

    assert.equal(user.status, UserStatus.BLOCKED)
    assert.lengthOf(savedUsers, 1)
    assert.isTrue(revoked)
    assert.lengthOf(flag.setCalls, 0, 'no extra block flag needed once status=BLOCKED')
  })

  test('tolerates token revocation failure after auto-block', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 9 })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const guard = new PinAttemptGuard(repo, counter.counter, flag.flag)
    ;(guard as unknown as { revokeTokens: (user: User) => Promise<void> }).revokeTokens =
      async () => {
        throw new Error('token service down')
      }
    const user = makeUser()

    await assert.doesNotReject(() => guard.recordFailure(user))
    assert.equal(user.status, UserStatus.BLOCKED)
    assert.lengthOf(savedUsers, 1)
  })

  test('does not mutate status when persistence fails on auto-block', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 9 })
    const flag = buildFlagStub()
    const savedUsers: User[] = []
    const repo = {
      save: async () => {
        throw new Error('DB down')
      },
    } as unknown as UserRepository
    let revoked = false
    const guard = new PinAttemptGuard(repo, counter.counter, flag.flag)
    ;(guard as unknown as { revokeTokens: (user: User) => Promise<void> }).revokeTokens =
      async () => {
        revoked = true
      }
    const user = makeUser()

    await assert.doesNotReject(() => guard.recordFailure(user))
    assert.isFalse(revoked, 'should not revoke tokens when persistence failed')
    assert.lengthOf(savedUsers, 0)
  })

  test('is silent when counter increment fails (fail-open)', async ({ assert }) => {
    const counter = buildCounterStub({ throwOnIncrement: true })
    const flag = buildFlagStub()
    const { repo, savedUsers } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await assert.doesNotReject(() => guard.recordFailure(makeUser()))
    assert.lengthOf(savedUsers, 0)
    assert.lengthOf(flag.setCalls, 0)
  })

  test('tolerates flag.set failure at a palier', async ({ assert }) => {
    const counter = buildCounterStub({ nextCount: 5 })
    const flag = buildFlagStub({ throwOnSet: true })
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await assert.doesNotReject(() => guard.recordFailure(makeUser()))
  })
})

test.group('PinAttemptGuard | recordSuccess', () => {
  test('resets counter and clears block flag', async ({ assert }) => {
    const counter = buildCounterStub()
    const flag = buildFlagStub()
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await guard.recordSuccess(42)

    assert.deepEqual(counter.resetCalls, ['auth:pin:failures:42'])
    assert.deepEqual(flag.clearCalls, ['auth:pin:block:42'])
  })

  test('does not throw when reset fails', async ({ assert }) => {
    const counter = buildCounterStub({ throwOnReset: true })
    const flag = buildFlagStub()
    const { repo } = buildUserRepoStub()
    const guard = buildGuard(counter.counter, flag.flag, repo)

    await assert.doesNotReject(() => guard.recordSuccess(42))
  })
})
