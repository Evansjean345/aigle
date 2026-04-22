import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#features/audit/domain/enums'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import type { AuditRecordInput } from '#shared/infrastructure/logging/audit_service'

const AUTH_FAIL_TO_METHOD: Record<string, string> = {
  USER_OTP_FAILED: 'OTP',
}

const BRUTE_FORCE_THRESHOLD = 5
const BRUTE_FORCE_WINDOW_SECONDS = 300

/**
 * Detects security-relevant patterns across the app: auth brute-force, etc.
 * Policy (thresholds, window) lives here; storage is delegated to a neutral
 * `SlidingWindowCounter` primitive so other auth surfaces (admin, webhook…)
 * can reuse the same infra with their own paliers.
 *
 * Registered as a listener on `activity:audit` — automatically reacts to
 * AUTH category events without auth use cases knowing about it.
 *
 * Degrades gracefully if the counter backend is unreachable: logs and skips
 * detection rather than blocking the calling flow.
 */
@inject()
export default class SecurityAlertDetector {
  /**
   * Initializes a new instance of the class with the provided SlidingWindowCounter.
   *
   * @param {SlidingWindowCounter} counter - An instance of SlidingWindowCounter used for managing counts within a sliding time window.
   */
  constructor(private readonly counter: SlidingWindowCounter) {}

  /**
   * Handles an audit record input related to authentication events.
   * Processes the input audit event to record failed authentication attempts depending on the event data.
   *
   * @param {AuditRecordInput} event - The audit record input containing information about the authentication event.
   * @return {Promise<void>} A promise that resolves once the processing of the authentication event is complete.
   */
  async handle(event: AuditRecordInput): Promise<void> {
    if (event.eventCategory !== 'AUTH') return

    const action = event.eventAction ?? ''
    const actorId = event.actorId !== null ? String(event.actorId) : ''
    const actorType = event.actorType ?? 'Unknown'
    const ipAddress = event.ipAddress ?? ''

    if (event.result === AuditResult.FAILURE) {
      const authMethod = AUTH_FAIL_TO_METHOD[action]

      if (!authMethod || !actorId) return
      await this.recordFailedAuthAttempt(actorId, actorType, ipAddress, authMethod)
    }
  }

  /**
   * Records a failed authentication attempt and triggers a security alert if the
   * number of attempts exceeds a predefined threshold within a specific time window.
   *
   * @param {string} actorId - The unique identifier of the actor (e.g., user or service).
   * @param {string} actorType - The type of actor (e.g., "user", "service").
   * @param {string} ipAddress - The IP address from which the authentication attempt was made.
   * @param {string} authMethod - The method used for authentication (e.g., "password", "OTP").
   * @return {Promise<void>} A promise that resolves once the failed attempt is recorded
   * and any necessary security alert is emitted.
   */
  async recordFailedAuthAttempt(
    actorId: string,
    actorType: string,
    ipAddress: string,
    authMethod: string
  ): Promise<void> {
    const key = `security_alert:failed_auth:${actorType}:${actorId}`
    let count: number

    try {
      count = await this.counter.increment(key, BRUTE_FORCE_WINDOW_SECONDS)
    } catch (error) {
      securityLog.error(
        'SECURITY_ALERT_DETECTOR_COUNTER_ERROR',
        { actorId, actorType, authMethod, error: (error as Error).message },
        'SecurityAlertDetector: counter unavailable, skipping brute-force detection'
      )
      return
    }

    if (count < BRUTE_FORCE_THRESHOLD) return

    emitter
      .emit('alert:security', {
        type: SecurityAlertType.BRUTE_FORCE,
        severity: AlertSeverity.CRITICAL,
        actorId,
        actorType,
        ipAddress,
        metadata: {
          attempts: count,
          windowSeconds: BRUTE_FORCE_WINDOW_SECONDS,
          authMethod,
        },
        detectedAt: DateTime.now(),
      })
      .catch(() => {})

    try {
      await this.counter.reset(key)
    } catch (error) {
      securityLog.error(
        'SECURITY_ALERT_DETECTOR_COUNTER_ERROR',
        { actorId, actorType, error: (error as Error).message },
        'SecurityAlertDetector: failed to reset counter after alert'
      )
    }
  }
}
