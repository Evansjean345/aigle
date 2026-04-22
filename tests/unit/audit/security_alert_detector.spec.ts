import { test } from '@japa/runner'
import SecurityAlertDetector from '#features/audit/application/services/security_alert_detector'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#features/audit/domain/enums'
import emitter from '@adonisjs/core/services/emitter'

function buildCounterStub(opts: { initialCount?: number; throwOnIncrement?: boolean } = {}) {
  const state = { count: opts.initialCount ?? 0, incrementCalls: 0, resetCalls: 0 }

  const counter = {
    increment: async () => {
      state.incrementCalls += 1
      if (opts.throwOnIncrement) throw new Error('Redis down')
      state.count += 1
      return state.count
    },
    reset: async () => {
      state.resetCalls += 1
    },
  }

  return { counter, state }
}

function captureAlerts() {
  const captured: any[] = []
  const listener = (payload: any) => captured.push(payload)
  emitter.on('alert:security', listener)
  return { captured, dispose: () => emitter.off('alert:security', listener) }
}

test.group('SecurityAlertDetector | recordFailedAuthAttempt', (group) => {
  let capture: ReturnType<typeof captureAlerts>

  group.each.setup(() => {
    capture = captureAlerts()
    return () => capture.dispose()
  })

  test('4 attempts = no alert emitted', async ({ assert }) => {
    const { counter } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    for (let i = 0; i < 4; i++) {
      await detector.recordFailedAuthAttempt('user-1', 'User', '1.2.3.4', 'PIN')
    }

    assert.lengthOf(capture.captured, 0)
  })

  test('5th attempt emits BRUTE_FORCE CRITICAL alert', async ({ assert }) => {
    const { counter, state } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    for (let i = 0; i < 5; i++) {
      await detector.recordFailedAuthAttempt('user-42', 'User', '5.6.7.8', 'PIN')
    }

    assert.lengthOf(capture.captured, 1)

    const alert = capture.captured[0]
    assert.equal(alert.type, SecurityAlertType.BRUTE_FORCE)
    assert.equal(alert.severity, AlertSeverity.CRITICAL)
    assert.equal(alert.actorId, 'user-42')
    assert.equal(alert.actorType, 'User')
    assert.equal(alert.metadata.authMethod, 'PIN')
    assert.equal(alert.metadata.attempts, 5)
    assert.equal(state.resetCalls, 1, 'counter should be reset after alert emission')
  })

  test('counter failure is caught and does not throw', async ({ assert }) => {
    const { counter } = buildCounterStub({ throwOnIncrement: true })
    const detector = new SecurityAlertDetector(counter as any)

    await assert.doesNotReject(() =>
      detector.recordFailedAuthAttempt('user-1', 'User', '1.2.3.4', 'PIN')
    )
    assert.lengthOf(capture.captured, 0)
  })
})

test.group('SecurityAlertDetector | handle (activity:audit listener)', (group) => {
  let capture: ReturnType<typeof captureAlerts>

  group.each.setup(() => {
    capture = captureAlerts()
    return () => capture.dispose()
  })

  test('ignores non-AUTH categories', async ({ assert }) => {
    const { counter, state } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    await detector.handle({
      eventCategory: 'KYC',
      eventAction: 'DOCUMENT_SUBMITTED',
      actorId: 'user-1',
      actorType: 'User',
      result: AuditResult.SUCCESS,
    } as any)

    assert.equal(state.incrementCalls, 0)
    assert.lengthOf(capture.captured, 0)
  })

  test('ignores USER_LOGIN_FAILED (handled by PinAttemptGuard)', async ({ assert }) => {
    const { counter, state } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    await detector.handle({
      eventCategory: 'AUTH',
      eventAction: 'USER_LOGIN_FAILED',
      actorId: '+2250700000000',
      actorType: 'User',
      result: AuditResult.FAILURE,
      ipAddress: '1.2.3.4',
    } as any)

    assert.equal(state.incrementCalls, 0)
    assert.lengthOf(capture.captured, 0)
  })

  test('routes USER_OTP_FAILED to brute-force detection with OTP method', async ({ assert }) => {
    const { counter, state } = buildCounterStub({ initialCount: 4 })
    const detector = new SecurityAlertDetector(counter as any)

    await detector.handle({
      eventCategory: 'AUTH',
      eventAction: 'USER_OTP_FAILED',
      actorId: '42',
      actorType: 'User',
      result: AuditResult.FAILURE,
      ipAddress: '1.2.3.4',
    } as any)

    assert.equal(state.count, 5)
    assert.lengthOf(capture.captured, 1)
    assert.equal(capture.captured[0].metadata.authMethod, 'OTP')
  })

  test('skips when failure event has no actorId', async ({ assert }) => {
    const { counter, state } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    await detector.handle({
      eventCategory: 'AUTH',
      eventAction: 'USER_LOGIN_FAILED',
      actorId: null,
      actorType: 'User',
      result: AuditResult.FAILURE,
    } as any)

    assert.equal(state.incrementCalls, 0)
    assert.lengthOf(capture.captured, 0)
  })

  test('ignores unknown failure actions', async ({ assert }) => {
    const { counter, state } = buildCounterStub()
    const detector = new SecurityAlertDetector(counter as any)

    await detector.handle({
      eventCategory: 'AUTH',
      eventAction: 'SOME_OTHER_AUTH_EVENT',
      actorId: 'user-1',
      actorType: 'User',
      result: AuditResult.FAILURE,
    } as any)

    assert.equal(state.incrementCalls, 0)
    assert.lengthOf(capture.captured, 0)
  })
})
