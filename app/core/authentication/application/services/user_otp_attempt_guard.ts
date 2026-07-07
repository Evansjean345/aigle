import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import User from '#core/user/domain/models/user'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import TimedFlag from '#shared/domain/cache/timed_flag'
import { UserStatus } from '#core/user/domain/enum'
import AccountBlockedException from '#core/authentication/domain/exceptions/account_blocked_exception'
import UserOtpTemporarilyBlockedException from '#core/authentication/domain/exceptions/user_otp_temporarily_blocked_exception'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#core/audit/domain/enums'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'
import { maskPhone } from '#shared/utils/utiles'

/**
 * Tier policy mirrors PinAttemptGuard so the mobile OTP surface is locked
 * down to the same standard as the PIN surface. Sorted descending so `find`
 * returns the highest matching palier first.
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
 * Brute-force protection for the mobile OTP verification surface
 * (login/register, forgot password, debit phone). Tracks failures per
 * **user id** in a 24h sliding window with the same paliers as the PIN guard:
 *   5→60s, 6→5min, 7→15min, 8→1h, 9→24h
 *
 * Why a separate guard instead of reusing `PinAttemptGuard`:
 *   - keys are isolated (`auth:user:otp:*` vs `auth:pin:*`), so a wrong PIN
 *     and a wrong OTP don't cross-pollute counters and falsely trigger blocks
 *   - the OTP attack vector is different: an attacker that bypasses
 *     `OtpVerificationService.maxAttempts=5` by regenerating fresh OTPs
 *     would otherwise reset the per-OTP counter — only a user-scoped sliding
 *     window catches that pattern across multiple OTPs
 *
 * Counts only **fully exhausted OTPs** (`OtpLockedException`), not individual
 * typos (`InvalidOtpException`). Rationale:
 *   - typos are already throttled by `OtpVerificationService.maxAttempts=5`
 *   - counting each typo would double-lock a legitimate fat-fingering user
 *   - the real cross-OTP attack manifests as repeated OTP exhaustion → that's
 *     what this guard catches
 *
 * Differences vs `AdminOtpAttemptGuard`:
 *   - keyed on numeric `user.id` (not email), since users are identified by
 *     phone but the user model is the canonical owner
 *   - permanent block sets `UserStatus.BLOCKED` (not `isActive=false`)
 *   - revokes `User.accessTokens` (not Admin's)
 *   - no super_admin escape hatch — every user is treated equally
 *
 * Degrades gracefully on Redis failures: logs and lets the calling flow
 * proceed rather than locking users out on infra issues.
 */
@inject()
export default class UserOtpAttemptGuard {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly counter: SlidingWindowCounter,
    private readonly block: TimedFlag
  ) {}

  /**
   * Throws if the account is permanently blocked or a temporary OTP block is
   * active. Should be called BEFORE invoking `OtpVerificationService.verify()`
   * so an attacker can't probe codes during the block window.
   */
  async assertNotBlocked(user: User): Promise<void> {
    if (user.status === UserStatus.BLOCKED) {
      throw new AccountBlockedException()
    }

    const remaining = await this.block.ttl(this.blockKey(user.id))

    if (remaining > 0) {
      throw new UserOtpTemporarilyBlockedException(remaining)
    }
  }

  /**
   * Records a failed OTP attempt at the user scope. Arms a temporary block
   * when a tier is reached and, at PERMANENT_BLOCK_AT, sets
   * `UserStatus.BLOCKED` and revokes its tokens.
   */
  async recordFailure(user: User, ipAddress: string | null): Promise<void> {
    let count: number

    try {
      count = await this.counter.increment(this.counterKey(user.id), COUNTER_WINDOW_SECONDS)
    } catch (error) {
      securityLog.error(
        'USER_OTP_GUARD_COUNTER_ERROR',
        { userId: user.id, error: (error as Error).message },
        'UserOtpAttemptGuard: counter unavailable, skipping attempt'
      )
      return
    }

    if (count >= PERMANENT_BLOCK_AT) {
      await this.autoBlockUser(user, ipAddress, count)
      return
    }

    const tier = TIERS.find((t) => t.at === count)
    if (tier) {
      try {
        await this.block.set(this.blockKey(user.id), tier.blockSeconds)
      } catch (error) {
        securityLog.error(
          'USER_OTP_GUARD_BLOCK_ERROR',
          { userId: user.id, error: (error as Error).message },
          'UserOtpAttemptGuard: failed to arm temporary block flag'
        )
      }
    }

    if (count === ALERT_AT) {
      this.emitAlert(user, ipAddress, count, false)
    }
  }

  async recordSuccess(userId: string | number): Promise<void> {
    try {
      await Promise.all([
        this.counter.reset(this.counterKey(userId)),
        this.block.clear(this.blockKey(userId)),
      ])
    } catch (error) {
      securityLog.error(
        'USER_OTP_GUARD_RESET_ERROR',
        { userId, error: (error as Error).message },
        'UserOtpAttemptGuard: failed to reset counter/block on success'
      )
    }
  }

  private async autoBlockUser(user: User, ipAddress: string | null, count: number): Promise<void> {
    user.status = UserStatus.BLOCKED

    try {
      await this.userRepository.save(user)
    } catch (error) {
      securityLog.error(
        'USER_OTP_GUARD_AUTO_BLOCK_SAVE_ERROR',
        { userId: user.id, error: (error as Error).message },
        'UserOtpAttemptGuard: failed to persist auto-block status'
      )
      return
    }

    try {
      await this.revokeTokens(user)
    } catch (error) {
      securityLog.error(
        'USER_OTP_GUARD_TOKEN_REVOCATION_ERROR',
        { userId: user.id, error: (error as Error).message },
        'UserOtpAttemptGuard: failed to revoke tokens after auto-block'
      )
    }

    securityLog.warn(
      'USER_OTP_AUTO_BLOCKED',
      { userId: user.id, attempts: count, ipAddress },
      'User auto-blocked after too many failed OTP attempts'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_OTP_AUTO_BLOCKED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress,
        errorCode: 'OTP_AUTO_BLOCKED',
        errorMessage: 'Too many failed OTP attempts',
        metadata: { attempts: count, authMethod: 'OTP', phone: maskPhone(user.phone) },
      })
      .catch(() => {})

    this.emitAlert(user, ipAddress, count, true)
  }

  private async revokeTokens(user: User): Promise<void> {
    const tokens = await User.accessTokens.all(user)
    await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))
  }

  private emitAlert(
    user: User,
    ipAddress: string | null,
    count: number,
    autoBlocked: boolean
  ): void {
    emitter
      .emit('alert:security', {
        type: SecurityAlertType.BRUTE_FORCE,
        severity: AlertSeverity.CRITICAL,
        actorId: String(user.id),
        actorType: 'User',
        ipAddress: ipAddress ?? '',
        metadata: {
          authMethod: 'OTP',
          attempts: count,
          autoBlocked,
          phone: maskPhone(user.phone),
        },
        detectedAt: DateTime.now(),
      })
      .catch(() => {})
  }

  private counterKey(userId: string | number): string {
    return `auth:user:otp:failures:${userId}`
  }

  private blockKey(userId: string | number): string {
    return `auth:user:otp:block:${userId}`
  }
}
