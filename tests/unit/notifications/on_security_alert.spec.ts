import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import OnSecurityAlert from '#features/notifications/application/listeners/on_security_alert'
import { type SecurityAlertEvent } from '#features/audit/application/types/security_alert_event'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#features/audit/domain/enums'

function buildEvent(overrides: Partial<SecurityAlertEvent> = {}): SecurityAlertEvent {
  return {
    type: SecurityAlertType.BRUTE_FORCE,
    severity: AlertSeverity.CRITICAL,
    actorId: 'user-1',
    actorType: 'User',
    ipAddress: '1.2.3.4',
    metadata: { attempts: 5, authMethod: 'PIN' },
    detectedAt: DateTime.now(),
    ...overrides,
  }
}

interface CapturedAudit {
  event: string
  data: any
}

interface CapturedMail {
  to: string[]
  subject: string
  htmlView: string
  viewData: Record<string, any>
}

function captureAudit(): { captured: CapturedAudit[]; dispose: () => void } {
  const captured: CapturedAudit[] = []
  const listener = (data: any) => {
    captured.push({ event: 'activity:audit', data })
  }
  emitter.on('activity:audit', listener)
  return { captured, dispose: () => emitter.off('activity:audit', listener) }
}

function buildDeps(recipientsCsv: string = 'ops@aigle.local') {
  const mails: CapturedMail[] = []
  const deps = {
    recipientsSource: () => recipientsCsv,
    mailDispatcher: async (payload: CapturedMail) => {
      mails.push(payload)
    },
  }
  return { deps, mails }
}

test.group('OnSecurityAlert | happy path', (group) => {
  let audit: { captured: CapturedAudit[]; dispose: () => void }
  group.each.setup(() => {
    audit = captureAudit()
    return () => audit.dispose()
  })

  test('dispatches templated email and emits SECURITY_ALERT audit event', async ({ assert }) => {
    const { deps, mails } = buildDeps('ops@aigle.local,security@aigle.local')
    const listener = new OnSecurityAlert(deps)

    await listener.handle(buildEvent())

    assert.lengthOf(mails, 1)
    assert.deepEqual(mails[0].to, ['ops@aigle.local', 'security@aigle.local'])
    assert.include(mails[0].subject, '[CRITICAL]')
    assert.include(mails[0].subject, 'BRUTE_FORCE')
    assert.equal(mails[0].htmlView, 'emails/security_alert')
    assert.equal(mails[0].viewData.alertLevel, 'critical')
    assert.equal(mails[0].viewData.alertType, SecurityAlertType.BRUTE_FORCE)
    assert.equal(mails[0].viewData.actorType, 'User')
    assert.equal(mails[0].viewData.actorId, 'user-1')
    assert.equal(mails[0].viewData.ipAddress, '1.2.3.4')
    assert.isString(mails[0].viewData.alertSummary)
    assert.isString(mails[0].viewData.recommendedAction)

    assert.lengthOf(audit.captured, 1)
    assert.equal(audit.captured[0].data.eventCategory, 'ALERT')
    assert.equal(audit.captured[0].data.eventAction, 'SECURITY_ALERT_BRUTE_FORCE')
    assert.equal(audit.captured[0].data.result, AuditResult.SUCCESS)
    assert.equal(audit.captured[0].data.targetType, 'SecurityAlert')
    assert.equal(audit.captured[0].data.metadata.alertType, SecurityAlertType.BRUTE_FORCE)
    assert.equal(audit.captured[0].data.metadata.severity, AlertSeverity.CRITICAL)
  })

  test('WARNING severity produces [WARNING] subject and warning level', async ({ assert }) => {
    const { deps, mails } = buildDeps()
    const listener = new OnSecurityAlert(deps)

    await listener.handle(
      buildEvent({ severity: AlertSeverity.WARNING, type: SecurityAlertType.OFF_HOURS_ACCESS })
    )

    assert.lengthOf(mails, 1)
    assert.include(mails[0].subject, '[WARNING]')
    assert.equal(mails[0].viewData.alertLevel, 'warning')
  })
})

test.group('OnSecurityAlert | edge cases', (group) => {
  let audit: { captured: CapturedAudit[]; dispose: () => void }
  group.each.setup(() => {
    audit = captureAudit()
    return () => audit.dispose()
  })

  test('no recipients configured: still emits audit but does not dispatch mail', async ({
    assert,
  }) => {
    const { deps, mails } = buildDeps('')
    const listener = new OnSecurityAlert(deps)

    await listener.handle(buildEvent())

    assert.lengthOf(mails, 0)
    assert.lengthOf(audit.captured, 1, 'audit should still be emitted when no recipients configured')
  })

  test('mail dispatcher throws: fallback logged, no exception bubbles up', async ({ assert }) => {
    const listener = new OnSecurityAlert({
      recipientsSource: () => 'ops@aigle.local',
      mailDispatcher: async () => {
        throw new Error('mail infra down')
      },
    })

    await assert.doesNotReject(() => listener.handle(buildEvent()))
    assert.lengthOf(audit.captured, 0, 'audit emission should be skipped when mail dispatch fails')
  })
})
