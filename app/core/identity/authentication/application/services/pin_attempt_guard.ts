import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import User from '#core/identity/user/domain/models/user'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import TimedFlag from '#shared/domain/cache/timed_flag'
import { UserStatus } from '#core/identity/user/domain/enum'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import PinTemporarilyBlockedException from '#core/identity/authentication/domain/exceptions/pin_temporarily_blocked_exception'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#core/audit/domain/enums'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'

/**
 * Tiered block durations (seconds) applied when the counter reaches the given
 * failure count. Sorted descending so `find` returns the highest matching palier.
 * The 9-failures row is a 24h safety net — the authoritative permanent block
 * is `UserStatus.BLOCKED` set below by `autoBlockUser`.
 */
const TIERS: Array<{ at: number; blockSeconds: number }> = [
  { at: 9, blockSeconds: 86400 },
  { at: 8, blockSeconds: 3600 },
  { at: 7, blockSeconds: 900 },
  { at: 6, blockSeconds: 300 },
  { at: 5, blockSeconds: 60 },
]

const ALERT_AT = 7
const PERMANENT_BLOCK_AT = 9
const COUNTER_WINDOW_SECONDS = 86400

/**
 * Orchestrates the response to failed PIN attempts:
 *   - tracks counts via `SlidingWindowCounter` (24h rolling window)
 *   - arms a `TimedFlag` block at each palier (5→60s, 6→5min, 7→15min, 8→1h, 9→24h)
 *   - mutates `UserStatus.BLOCKED` and revokes tokens at the permanent threshold
 *   - emits `alert:security` / `activity:audit` when thresholds cross
 *
 * Policy (paliers, alert level) lives here; storage primitives are neutral
 * so other auth surfaces can reuse them with their own paliers.
 *
 * Degrades gracefully on infra failures: logs and allows the calling flow
 * to proceed rather than locking users out on Redis issues.
 */
@inject()
export default class PinAttemptGuard {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly counter: SlidingWindowCounter,
    private readonly block: TimedFlag
  ) {}

  async assertNotBlocked(user: User): Promise<void> {
    if (user.status === UserStatus.BLOCKED) {
      throw new AccountBlockedException()
    }

    const remaining = await this.block.ttl(this.blockKey(user.id))

    if (remaining > 0) {
      throw new PinTemporarilyBlockedException(remaining)
    }
  }

  /**
   * Records a failure attempt for a user, manages failure count, applies blocking logic,
   * and emits alerts if necessary.
   *
   * @param {User} user - The user object for whom the failure is being recorded.
   * @return {Promise<void>} Resolves when the failure has been recorded and all actions (such as blocking or alerts) have been processed.
   */
  async recordFailure(user: User): Promise<void> {
    let count: number

    try {
      count = await this.counter.increment(this.counterKey(user.id), COUNTER_WINDOW_SECONDS)
    } catch (error) {
      securityLog.error(
        'PIN_GUARD_COUNTER_ERROR',
        { userId: user.id, error: (error as Error).message },
        'PinAttemptGuard: counter unavailable, skipping attempt'
      )
      return
    }

    if (count >= PERMANENT_BLOCK_AT) {
      await this.autoBlockUser(user, count)
      return
    }

    const tier = TIERS.find((t) => t.at === count)
    if (tier) {
      try {
        await this.block.set(this.blockKey(user.id), tier.blockSeconds)
      } catch (error) {
        securityLog.error(
          'PIN_GUARD_BLOCK_ERROR',
          { userId: user.id, error: (error as Error).message },
          'PinAttemptGuard: failed to arm temporary block flag'
        )
      }
    }

    if (count === ALERT_AT) {
      this.emitAlert(user, count, false)
    }
  }

  /**
   * Resets the counter and clears the block for a given user upon a successful operation.
   *
   * @param {string | number} userId - The unique identifier of the user for whom the success needs to be recorded.
   * @return {Promise<void>} A promise that resolves when the counter and block have been successfully reset.
   */
  async recordSuccess(userId: string | number): Promise<void> {
    try {
      await Promise.all([
        this.counter.reset(this.counterKey(userId)),
        this.block.clear(this.blockKey(userId)),
      ])
    } catch (error) {
      securityLog.error(
        'PIN_GUARD_RESET_ERROR',
        { userId, error: (error as Error).message },
        'PinAttemptGuard: failed to reset counter/block on success'
      )
    }
  }

  /**
   * Revokes all active access tokens associated with a given user.
   *
   * @param {User} user - The user object for which all access tokens will be revoked.
   * @return {Promise<void>} A promise that resolves once all tokens have been successfully revoked.
   */
  private async revokeTokens(user: User): Promise<void> {
    const tokens = await User.accessTokens.all(user)
    await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))
  }

  /**
   * Automatically blocks a user after exceeding a specified number of failed PIN attempts.
   * Sets the user's status to `BLOCKED`, saves the status, revokes tokens, logs security events, and emits an alert.
   *
   * @param {User} user - The user object representing the user to be blocked.
   * @param {number} count - The number of failed PIN attempts that triggered the auto-blocking.
   * @return {Promise<void>} A promise that resolves when the auto-blocking process is complete.
   */
  private async autoBlockUser(user: User, count: number): Promise<void> {
    //TODO: deleguer la responsabilité du blocage du compte directement au repository
    user.status = UserStatus.BLOCKED

    try {
      await this.userRepository.save(user)
    } catch (error) {
      securityLog.error(
        'PIN_GUARD_AUTO_BLOCK_SAVE_ERROR',
        { userId: user.id, error: (error as Error).message },
        'PinAttemptGuard: failed to persist auto-block status'
      )
      return
    }

    try {
      await this.revokeTokens(user)
    } catch (error) {
      securityLog.error(
        'PIN_GUARD_TOKEN_REVOCATION_ERROR',
        { userId: user.id, error: (error as Error).message },
        'PinAttemptGuard: failed to revoke tokens after auto-block'
      )
    }

    securityLog.warn(
      'USER_AUTO_BLOCKED',
      { userId: user.id, attempts: count },
      'User auto-blocked after too many failed PIN attempts'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_AUTO_BLOCKED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        errorCode: 'AUTO_BLOCKED',
        errorMessage: 'Too many failed PIN attempts',
        metadata: { attempts: count, authMethod: 'PIN' },
      })
      .catch(() => {})

    this.emitAlert(user, count, true)
  }

  /**
   * Emits a security alert for a brute force attempt.
   *
   * @param {User} user - The user associated with the alert.
   * @param {number} count - The number of failed attempts triggering the alert.
   * @param {boolean} autoBlocked - Indicates whether the user was automatically blocked due to the alert.
   * @return {void} This method does not return a value.
   */
  private emitAlert(user: User, count: number, autoBlocked: boolean): void {
    emitter
      .emit('alert:security', {
        type: SecurityAlertType.BRUTE_FORCE,
        severity: AlertSeverity.CRITICAL,
        actorId: String(user.id),
        actorType: 'User',
        ipAddress: '',
        metadata: {
          authMethod: 'PIN',
          attempts: count,
          autoBlocked,
        },
        detectedAt: DateTime.now(),
      })
      .catch(() => {})
  }

  private counterKey(userId: string | number): string {
    return `auth:pin:failures:${userId}`
  }

  private blockKey(userId: string | number): string {
    return `auth:pin:block:${userId}`
  }
}
