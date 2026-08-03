import { test } from '@japa/runner'
import AdminAttemptGuard from '#core/team/authentication/application/services/admin_attempt_guard'
import AdminOtpAttemptGuard from '#core/team/authentication/application/services/admin_otp_attempt_guard'
import type AdminRepository from '#core/team/domain/interfaces/admin_repository'
import type Admin from '#core/team/domain/models/admin'
import type SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import type TimedFlag from '#shared/domain/cache/timed_flag'

/**
 * L'exemption de blocage définitif ne vise plus un nom de rôle mais le dernier compte actif :
 * désactiver celui-là fermerait le back-office sans autre recours qu'une intervention en base.
 */

const PERMANENT_BLOCK_THRESHOLD = 9

interface Harness {
  guard: AdminAttemptGuard | AdminOtpAttemptGuard
  admin: Admin
  saved: Admin[]
}

/**
 * Construit une garde dont le compteur atteint d'emblée le seuil de blocage définitif.
 *
 * @param {'password' | 'otp'} kind - La garde à instancier.
 * @param {number} activeAdmins - Nombre d'administrateurs encore actifs.
 * @returns {Harness} La garde, le compte visé et les sauvegardes observées.
 */
function buildHarness(kind: 'password' | 'otp', activeAdmins: number): Harness {
  const saved: Admin[] = []

  const admin = {
    id: 1,
    email: 'admin@aigle.test',
    isActive: true,
    role: { slug: 'root', name: 'Root' },
    related: () => ({ query: () => ({ delete: async () => {} }) }),
  } as unknown as Admin

  const repository = {
    findByEmail: async () => admin,
    countActive: async () => activeAdmins,
    save: async (value: Admin) => {
      saved.push(value)
      return value
    },
  } as unknown as AdminRepository

  const counter = {
    increment: async () => PERMANENT_BLOCK_THRESHOLD,
    reset: async () => {},
  } as unknown as SlidingWindowCounter

  const block = {
    set: async () => {},
    clear: async () => {},
    ttl: async () => 0,
  } as unknown as TimedFlag

  const guard =
    kind === 'password'
      ? new AdminAttemptGuard(repository, counter, block)
      : new AdminOtpAttemptGuard(repository, counter, block)

  return { guard, admin, saved }
}

test.group('Team | exemption de blocage définitif', () => {
  test('le dernier compte actif n’est jamais désactivé — mot de passe', async ({ assert }) => {
    const { guard, admin, saved } = buildHarness('password', 1)

    await guard.recordFailure(admin.email, '10.0.0.1')

    assert.isTrue(admin.isActive)
    assert.isEmpty(saved)
  })

  test('le dernier compte actif n’est jamais désactivé — OTP', async ({ assert }) => {
    const { guard, admin, saved } = buildHarness('otp', 1)

    await guard.recordFailure(admin.email, '10.0.0.1')

    assert.isTrue(admin.isActive)
    assert.isEmpty(saved)
  })

  test('un compte parmi plusieurs est désactivé — mot de passe', async ({ assert }) => {
    const { guard, admin, saved } = buildHarness('password', 2)

    await guard.recordFailure(admin.email, '10.0.0.1')

    assert.isFalse(admin.isActive)
    assert.lengthOf(saved, 1)
  })

  test('un compte parmi plusieurs est désactivé — OTP', async ({ assert }) => {
    const { guard, admin, saved } = buildHarness('otp', 2)

    await guard.recordFailure(admin.email, '10.0.0.1')

    assert.isFalse(admin.isActive)
    assert.lengthOf(saved, 1)
  })

  test('le rôle ne détermine plus l’exemption : root est désactivable', async ({ assert }) => {
    const { guard, admin } = buildHarness('password', 3)

    await guard.recordFailure(admin.email, '10.0.0.1')

    assert.isFalse(admin.isActive, 'porter le rôle root ne dispense plus du blocage définitif')
  })
})
