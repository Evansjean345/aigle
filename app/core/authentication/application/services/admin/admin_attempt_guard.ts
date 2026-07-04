import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Admin from '#core/team/domain/models/admin'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'
import TimedFlag from '#shared/domain/cache/timed_flag'
import AdminAccountBlockedException from '#core/team/infrastructure/exceptions/admin_account_blocked_exception'
import AdminTemporarilyBlockedException from '#core/team/infrastructure/exceptions/admin_temporarily_blocked_exception'
import { SecurityAlertType, AlertSeverity, AuditResult } from '#core/audit/domain/enums'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'

/**
 * Tier policy mirrors PinAttemptGuard (mobile parity). Sorted descending so
 * `find` returns the highest matching palier first.
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
const SUPER_ADMIN_SLUG = 'super_admin'

/**
 * Brute-force protection for admin password login. Same paliers as the mobile
 * PIN guard (5→60s, 6→5min, 7→15min, 8→1h, 9→24h) so the most critical surface
 * is at least as locked-down as the mobile one.
 *
 * Unlike the mobile guard, this tracks attempts by **email** because the admin
 * is unknown until credentials verify. The email is lowercased before keying.
 *
 * Policy difference for `super_admin` (operational safety):
 *   - tier-based temporary blocks still apply
 *   - the permanent block (`isActive = false`) is **not** applied — instead a
 *     CRITICAL escalation alert is emitted so other super_admins can intervene
 *
 * Degrades gracefully on Redis failures: logs and lets the calling flow proceed.
 */
@inject()
export default class AdminAttemptGuard {
  /**
   * Constructs a new instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository instance to manage admin data.
   * @param {SlidingWindowCounter} counter - The sliding window counter for rate-limiting or tracking events.
   * @param {TimedFlag} block - The timed flag used to manage state changes over a specified duration.
   */
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly counter: SlidingWindowCounter,
    private readonly block: TimedFlag
  ) {}

  /**
   * Checks if the given email is currently blocked and throws an exception if it is.
   *
   * @param email The email address to check for a block status.
   * @return A promise that resolves if the email is not blocked, or throws an exception if it is blocked.
   */
  async assertNotBlocked(email: string): Promise<void> {
    const remaining = await this.block.ttl(this.blockKey(email))

    if (remaining > 0) {
      throw new AdminTemporarilyBlockedException(remaining)
    }
  }

  /**
   * Checks if the provided admin account is active.
   * Throws an exception if the admin account is blocked.
   *
   * @param {Admin} admin - The admin object to be validated.
   * @return {Promise<void>} A promise that resolves if the admin account is active, or rejects with an exception if not.
   */
  async assertAdminActive(admin: Admin): Promise<void> {
    if (!admin.isActive) {
      throw new AdminAccountBlockedException()
    }
  }

  /**
   * Records a failed admin login attempt. Arms a temporary block when a tier
   * is reached and, at PERMANENT_BLOCK_AT, deactivates the account (except for
   * super_admin) and revokes its tokens.
   *
   * Looking up the admin only at threshold hits keeps the hot path cheap —
   * cheap counter increments cost a single Redis op per failure.
   */
  async recordFailure(email: string, ipAddress: string | null): Promise<void> {
    let count: number

    try {
      count = await this.counter.increment(this.counterKey(email), COUNTER_WINDOW_SECONDS)
    } catch (error) {
      securityLog.error(
        'ADMIN_GUARD_COUNTER_ERROR',
        { email, error: (error as Error).message },
        'AdminAttemptGuard: counter unavailable, skipping attempt'
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
          'ADMIN_GUARD_BLOCK_ERROR',
          { email, error: (error as Error).message },
          'AdminAttemptGuard: failed to arm temporary block flag'
        )
      }
    }

    if (count === ALERT_AT) {
      this.emitAlert(email, null, ipAddress, count, false)
    }
  }

  /**
   * Resets the failure counter and clears any block associated with the provided email address.
   * This method is typically used after a successful operation to ensure the system does not
   * unnecessarily block further attempts for the given email.
   *
   * @param {string} email - The email address for which success should be recorded.
   * @return {Promise<void>} A promise that resolves once the reset and cleanup operations are completed.
   */
  async recordSuccess(email: string): Promise<void> {
    try {
      await Promise.all([
        this.counter.reset(this.counterKey(email)),
        this.block.clear(this.blockKey(email)),
      ])
    } catch (error) {
      securityLog.error(
        'ADMIN_GUARD_RESET_ERROR',
        { email, error: (error as Error).message },
        'AdminAttemptGuard: failed to reset counter/block on success'
      )
    }
  }

  /**
   * Handles the permanent block logic for a given email and IP address based on failed login attempts.
   *
   * @param {string} email - The email address of the user or admin to block.
   * @param {string|null} ipAddress - The IP address from which the failed attempts originated. It can be `null` if unavailable.
   * @param {number} count - The number of failed login attempts that triggered the permanent block.
   * @return {Promise<void>} A promise that resolves with no value when the method completes its execution.
   */
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

    const isSuperAdmin = admin.role?.slug === SUPER_ADMIN_SLUG

    try {
      await this.block.set(this.blockKey(email), TIERS[0].blockSeconds)
    } catch (error) {
      securityLog.error(
        'ADMIN_GUARD_BLOCK_ERROR',
        { email, adminId: admin.id, error: (error as Error).message },
        'AdminAttemptGuard: failed to arm 24h block flag'
      )
    }

    if (isSuperAdmin) {
      securityLog.warn(
        'ADMIN_SUPER_ADMIN_BRUTE_FORCE',
        { adminId: admin.id, attempts: count, ipAddress },
        'super_admin reached permanent-block threshold — temporary block applied, manual review required'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'ADMIN_SUPER_ADMIN_LOCK_ATTEMPT',
          actorId: String(admin.id),
          actorType: 'Admin',
          actorRole: admin.role?.name ?? null,
          targetType: 'Admin',
          targetId: String(admin.id),
          result: AuditResult.FAILURE,
          ipAddress,
          errorCode: 'SUPER_ADMIN_NOT_AUTO_BLOCKED',
          errorMessage: 'Permanent block skipped for super_admin — manual review required',
          metadata: { attempts: count, authMethod: 'PASSWORD' },
        })
        .catch(() => {})

      this.emitAlert(admin.email, String(admin.id), ipAddress, count, false)
      return
    }

    await this.autoBlockAdmin(admin, ipAddress, count)
  }

  /**
   * Automatically blocks an admin user after too many failed login attempts.
   * This method sets the admin's status to inactive, persists the change, revokes all tokens,
   * logs the security event, and triggers any necessary audit or alert mechanisms.
   *
   * @param admin The admin user to be automatically blocked.
   * @param ipAddress The IP address of the device responsible for the failed attempts, if available.
   * @param count The number of failed login attempts that triggered the auto-block.
   * @return A promise that resolves when the auto-block operation is completed.
   */
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
        'ADMIN_GUARD_AUTO_BLOCK_SAVE_ERROR',
        { adminId: admin.id, error: (error as Error).message },
        'AdminAttemptGuard: failed to persist auto-block status'
      )
      return
    }

    try {
      await this.revokeTokens(admin)
    } catch (error) {
      securityLog.error(
        'ADMIN_GUARD_TOKEN_REVOCATION_ERROR',
        { adminId: admin.id, error: (error as Error).message },
        'AdminAttemptGuard: failed to revoke tokens after auto-block'
      )
    }

    securityLog.warn(
      'ADMIN_AUTO_BLOCKED',
      { adminId: admin.id, attempts: count, ipAddress },
      'Admin auto-blocked after too many failed login attempts'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'ADMIN_AUTO_BLOCKED',
        actorId: String(admin.id),
        actorType: 'Admin',
        actorRole: admin.role?.name ?? null,
        targetType: 'Admin',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        ipAddress,
        errorCode: 'AUTO_BLOCKED',
        errorMessage: 'Too many failed login attempts',
        metadata: { attempts: count, authMethod: 'PASSWORD' },
      })
      .catch(() => {})

    this.emitAlert(admin.email, String(admin.id), ipAddress, count, true)
  }

  /**
   * Revokes all access tokens associated with the specified admin.
   *
   * @param {Admin} admin - The admin whose access tokens are to be revoked.
   * @return {Promise<void>} A promise that resolves when all tokens have been successfully revoked.
   */
  private async revokeTokens(admin: Admin): Promise<void> {
    const tokens = await Admin.accessTokens.all(admin)
    await Promise.all(tokens.map((token) => Admin.accessTokens.delete(admin, token.identifier)))
  }

  /**
   * Emits a security alert for brute force attempts.
   *
   * @param {string} email - The email address of the affected admin user.
   * @param {string | null} adminId - The unique identifier of the admin user, or null if not available.
   * @param {string | null} ipAddress - The IP address of the client making the attempts, or null if not available.
   * @param {number} count - The number of authentication attempts detected.
   * @param {boolean} autoBlocked - Indicates whether the user was automatically blocked due to the attempts.
   * @return {void} This method does not return a value.
   */
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
          authMethod: 'PASSWORD',
          attempts: count,
          autoBlocked,
          email,
        },
        detectedAt: DateTime.now(),
      })
      .catch(() => {})
  }

  /**
   * Generates a unique key string used for tracking authentication failures
   * associated with the given email address.
   *
   * @param email The user's email address for which the key is generated.
   * @return A string key formatted as "auth:admin:failures:{email}" with the email in lowercase.
   */
  private counterKey(email: string): string {
    return `auth:admin:failures:${email.toLowerCase()}`
  }

  /**
   * Generates a formatted block key string for administrative use.
   *
   * @param email The email address to be converted into a block key. It is case-insensitive.
   * @return A string representing the block key, formatted as `auth:admin:block:lowercase-email`.
   */
  private blockKey(email: string): string {
    return `auth:admin:block:${email.toLowerCase()}`
  }
}
