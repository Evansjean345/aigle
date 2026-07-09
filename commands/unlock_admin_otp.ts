import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import AdminOtpAttemptGuard from '#core/team/authentication/application/services/admin_otp_attempt_guard'

/**
 * Clears the brute-force lockout state for an admin's email-scoped OTP guard
 * (`auth:admin:otp:failures:*` and `auth:admin:otp:block:*` Redis keys).
 *
 * Use cases:
 *   - dev / QA: a tester hit the 24h sliding window and needs to keep working
 *   - prod support: a legitimate admin reports being locked out and the SOC
 *     has confirmed it's not an active attack
 *
 * Does NOT touch:
 *   - the per-OTP lock managed by OtpVerificationService (max 60s, expires
 *     on its own and resets on the next attempt)
 *   - the password guard (auth:admin:failures:* / auth:admin:block:*) —
 *     pass `--include-password` if you also want to reset that surface
 *   - `Admin.isActive` — pass `--reactivate` to also re-enable a permanently
 *     blocked account (use with caution: the account was deactivated for a
 *     reason)
 */
export default class UnlockAdminOtp extends BaseCommand {
  static commandName = 'admin:unlock-otp'
  static description = 'Clear brute-force lockout state for an admin OTP login'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Admin email to unlock' })
  declare email: string

  @flags.boolean({
    description: 'Also clear the password attempt guard for this email',
    default: false,
  })
  declare includePassword: boolean

  @flags.boolean({
    description: 'Also reactivate the account if isActive=false',
    default: false,
  })
  declare reactivate: boolean

  async run(): Promise<void> {
    const email = this.email.toLowerCase().trim()

    if (!email.includes('@')) {
      this.logger.error(`Invalid email: "${this.email}"`)
      this.exitCode = 1
      return
    }

    const adminRepository = await this.app.container.make(AdminRepository)
    const admin = await adminRepository.findByEmail(email)

    if (!admin) {
      this.logger.warning(
        `No admin found for ${email} — clearing Redis keys anyway in case of stale state`
      )
    } else {
      this.logger.info(
        `Found admin #${admin.id} (${admin.firstname} ${admin.lastname}, isActive=${admin.isActive})`
      )
    }

    const otpGuard = await this.app.container.make(AdminOtpAttemptGuard)
    await otpGuard.recordSuccess(email)
    this.logger.success(`OTP guard cleared (auth:admin:otp:* for ${email})`)

    if (this.includePassword) {
      const { default: AdminAttemptGuard } =
        await import('#core/team/authentication/application/services/admin_attempt_guard')
      const passwordGuard = await this.app.container.make(AdminAttemptGuard)
      await passwordGuard.recordSuccess(email)
      this.logger.success(`Password guard cleared (auth:admin:* for ${email})`)
    }

    if (this.reactivate && admin && !admin.isActive) {
      admin.isActive = true
      await adminRepository.save(admin)
      this.logger.success(`Account reactivated (isActive=true)`)
    } else if (this.reactivate && admin?.isActive) {
      this.logger.info('Account already active — no change')
    } else if (!this.reactivate && admin && !admin.isActive) {
      this.logger.warning(
        'Account is deactivated. Pass --reactivate if you also want to re-enable it.'
      )
    }
  }
}
