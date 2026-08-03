import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Admin from '#core/team/domain/models/admin'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import TimedFlag from '#shared/domain/cache/timed_flag'
import AdminAccountBlockedException from '#core/team/domain/exceptions/admin_account_blocked_exception'
import AdminTemporarilyBlockedException from '#core/team/domain/exceptions/admin_temporarily_blocked_exception'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#core/audit/domain/enums'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'

/**
 * Tier policy mirrors AdminAttemptGuard / PinAttemptGuard so the OTP surface is
 * locked down to the same standard as the password surface. Sorted descending
 * so `find` returns the highest matching palier first.
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
 * Brute-force protection for the admin OTP step (post-credentials 2FA and
 * post-invitation setup). Tracks failures per **email** in a 24h sliding
 * window with the same paliers as the password guard:
 *   5→60s, 6→5min, 7→15min, 8→1h, 9→24h
 *
 * Why a separate guard instead of reusing `AdminAttemptGuard`:
 *   - keys are isolated (`auth:admin:otp:*`), so a failed password and a
 *     failed OTP don't cross-pollute counters and falsely trigger blocks
 *   - the OTP surface is shorter-lived (each OTP TTL ≤ 15min), but an
 *     attacker that bypasses `OtpVerificationService.maxAttempts` by
 *     generating a fresh OTP every minute would otherwise reset the
 *     per-OTP counter — only an email-scoped sliding window catches that
 *
 * Policy difference for the last active admin (operational safety):
 *   - tier-based temporary blocks still apply
 *   - the permanent block (`isActive = false`) is **not** applied — instead a
 *     CRITICAL escalation alert is emitted. Deactivating the last account would
 *     leave the back-office with no way in, recoverable only from the database.
 *
 * Degrades gracefully on Redis failures: logs and lets the calling flow
 * proceed rather than locking admins out on infra issues.
 */
@inject()
export default class AdminOtpAttemptGuard {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly counter: SlidingWindowCounter,
    private readonly block: TimedFlag
  ) {}

  /**
   * Throws if a temporary OTP block is active for the given email. Should be
   * called BEFORE invoking `OtpVerificationService.verify()` so an attacker
   * can't probe codes during the block window.
   */
  async assertNotBlocked(email: string): Promise<void> {
    const remaining = await this.block.ttl(this.blockKey(email))

    if (remaining > 0) {
      throw new AdminTemporarilyBlockedException(remaining)
    }
  }

  async assertAdminActive(admin: Admin): Promise<void> {
    if (!admin.isActive) {
      throw new AdminAccountBlockedException()
    }
  }

  /**
   * Records a failed OTP attempt. Arms a temporary block when a tier is
   * reached and, at PERMANENT_BLOCK_AT, deactivates the account (except for
   * super_admin) and revokes its tokens.
   */
  async recordFailure(email: string, ipAddress: string | null): Promise<void> {
    let count: number

    try {
      count = await this.counter.increment(this.counterKey(email), COUNTER_WINDOW_SECONDS)
    } catch (error) {
      securityLog.error(
        'ADMIN_OTP_GUARD_COUNTER_ERROR',
        { email, error: (error as Error).message },
        'AdminOtpAttemptGuard: counter unavailable, skipping attempt'
      )
      return
    }

    if (count >= PERMANENT_BLOCK_AT) {
      await this.handlePermanentBlock(email, ipAddress, count)
      return
    }

    const tier = TIERS.find((t) => t.at === count)

    if (tier) {
      try {
        await this.block.set(this.blockKey(email), tier.blockSeconds)
      } catch (error) {
        securityLog.error(
          'ADMIN_OTP_GUARD_BLOCK_ERROR',
          { email, error: (error as Error).message },
          'AdminOtpAttemptGuard: failed to arm temporary block flag'
        )
      }
    }

    if (count === ALERT_AT) {
      this.emitAlert(email, null, ipAddress, count, false)
    }
  }

  async recordSuccess(email: string): Promise<void> {
    try {
      await Promise.all([
        this.counter.reset(this.counterKey(email)),
        this.block.clear(this.blockKey(email)),
      ])
    } catch (error) {
      securityLog.error(
        'ADMIN_OTP_GUARD_RESET_ERROR',
        { email, error: (error as Error).message },
        'AdminOtpAttemptGuard: failed to reset counter/block on success'
      )
    }
  }

  private async handlePermanentBlock(
    email: string,
    ipAddress: string | null,
    count: number
  ): Promise<void> {
    const admin = await this.adminRepository.findByEmail(email)

    if (!admin) {
      try {
        await this.block.set(this.blockKey(email), TIERS[0].blockSeconds)
      } catch {}

      this.emitAlert(email, null, ipAddress, count, false)
      return
    }

    const isLastActiveAdmin = admin.isActive && (await this.adminRepository.countActive()) <= 1

    try {
      await this.block.set(this.blockKey(email), TIERS[0].blockSeconds)
    } catch (error) {
      securityLog.error(
        'ADMIN_OTP_GUARD_BLOCK_ERROR',
        { email, adminId: admin.id, error: (error as Error).message },
        'AdminOtpAttemptGuard: failed to arm 24h block flag'
      )
    }

    if (isLastActiveAdmin) {
      securityLog.warn(
        'ADMIN_LAST_ACTIVE_OTP_BRUTE_FORCE',
        { adminId: admin.id, attempts: count, ipAddress },
        'last active admin reached permanent-block threshold on OTP — temporary block applied, manual review required'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'ADMIN_LAST_ACTIVE_OTP_LOCK_ATTEMPT',
          actorId: String(admin.id),
          actorType: 'Admin',
          actorRole: admin.role?.name ?? null,
          targetType: 'Admin',
          targetId: String(admin.id),
          result: AuditResult.FAILURE,
          ipAddress,
          errorCode: 'LAST_ACTIVE_ADMIN_NOT_AUTO_BLOCKED',
          errorMessage:
            'Permanent OTP block skipped for the last active admin — manual review required',
          metadata: { attempts: count, authMethod: 'OTP' },
        })
        .catch(() => {})

      this.emitAlert(admin.email, String(admin.id), ipAddress, count, false)
      return
    }

    await this.autoBlockAdmin(admin, ipAddress, count)
  }

  private async autoBlockAdmin(
    admin: Admin,
    ipAddress: string | null,
    count: number
  ): Promise<void> {
    admin.isActive = false

    try {
      await this.adminRepository.save(admin)
    } catch (error) {
      securityLog.error(
        'ADMIN_OTP_GUARD_AUTO_BLOCK_SAVE_ERROR',
        { adminId: admin.id, error: (error as Error).message },
        'AdminOtpAttemptGuard: failed to persist auto-block status'
      )
      return
    }

    try {
      await this.revokeTokens(admin)
    } catch (error) {
      securityLog.error(
        'ADMIN_OTP_GUARD_TOKEN_REVOCATION_ERROR',
        { adminId: admin.id, error: (error as Error).message },
        'AdminOtpAttemptGuard: failed to revoke tokens after auto-block'
      )
    }

    securityLog.warn(
      'ADMIN_OTP_AUTO_BLOCKED',
      { adminId: admin.id, attempts: count, ipAddress },
      'Admin auto-blocked after too many failed OTP attempts'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'ADMIN_OTP_AUTO_BLOCKED',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role?.name ?? null,
        targetType: 'Admin',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress,
        errorCode: 'OTP_AUTO_BLOCKED',
        errorMessage: 'Too many failed OTP attempts',
        metadata: { attempts: count, authMethod: 'OTP' },
      })
      .catch(() => {})

    this.emitAlert(admin.email, String(admin.id), ipAddress, count, true)
  }

  private async revokeTokens(admin: Admin): Promise<void> {
    const tokens = await Admin.accessTokens.all(admin)
    await Promise.all(tokens.map((token) => Admin.accessTokens.delete(admin, token.identifier)))
  }

  private emitAlert(
    email: string,
    adminId: string | null,
    ipAddress: string | null,
    count: number,
    autoBlocked: boolean
  ): void {
    emitter
      .emit('alert:security', {
        type: SecurityAlertType.BRUTE_FORCE,
        severity: AlertSeverity.CRITICAL,
        actorId: adminId ?? email,
        actorType: 'Admin',
        ipAddress: ipAddress ?? '',
        metadata: {
          authMethod: 'OTP',
          attempts: count,
          autoBlocked,
          email,
        },
        detectedAt: DateTime.now(),
      })
      .catch(() => {})
  }

  private counterKey(email: string): string {
    return `auth:admin:otp:failures:${email.toLowerCase()}`
  }

  private blockKey(email: string): string {
    return `auth:admin:otp:block:${email.toLowerCase()}`
  }
}
