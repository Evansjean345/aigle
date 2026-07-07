import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import UserOtpAttemptGuard from '#core/authentication/application/services/user_otp_attempt_guard'
import { UserStatus } from '#core/user/domain/enum'
import { normalizePhone } from '#shared/utils/utiles'

/**
 * Clears the brute-force lockout state for a user's id-scoped OTP guard
 * (`auth:user:otp:failures:*` and `auth:user:otp:block:*` Redis keys).
 *
 * Use cases:
 *   - dev / QA: a tester hit the 24h sliding window and needs to keep working
 *   - prod support: a legitimate user reports being locked out and the SOC
 *     has confirmed it's not an active attack
 *
 * Lookup is by phone (E.164 or raw — normalized internally).
 *
 * Does NOT touch:
 *   - the per-OTP lock managed by OtpVerificationService (max 60s, expires
 *     on its own and resets on the next attempt)
 *   - the PIN guard (`auth:pin:*`) — pass `--include-pin` to also reset that
 *   - `User.status` — pass `--reactivate` to also re-enable a permanently
 *     blocked account (use with caution: the account was BLOCKED for a
 *     reason, brute-force lockouts often correlate with real attacks)
 */
export default class UnlockUserOtp extends BaseCommand {
  static commandName = 'user:unlock-otp'
  static description = 'Clear brute-force lockout state for a user OTP login'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'User phone number to unlock (E.164 or raw)' })
  declare phone: string

  @flags.boolean({
    description: 'Also clear the PIN attempt guard for this user',
    default: false,
  })
  declare includePin: boolean

  @flags.boolean({
    description: 'Also reactivate the account if status=BLOCKED',
    default: false,
  })
  declare reactivate: boolean

  async run(): Promise<void> {
    const userRepository = await this.app.container.make(UserRepository)
    const user = await userRepository.findByPhone(normalizePhone(this.phone))

    if (!user) {
      this.logger.error(`No user found for phone "${this.phone}"`)
      this.exitCode = 1
      return
    }

    this.logger.info(
      `Found user #${user.id} (${user.firstname ?? '?'} ${user.lastname ?? '?'}, status=${user.status})`
    )

    const otpGuard = await this.app.container.make(UserOtpAttemptGuard)
    await otpGuard.recordSuccess(user.id)
    this.logger.success(`OTP guard cleared (auth:user:otp:* for user #${user.id})`)

    if (this.includePin) {
      const { default: PinAttemptGuard } =
        await import('#core/authentication/application/services/pin_attempt_guard')
      const pinGuard = await this.app.container.make(PinAttemptGuard)
      await pinGuard.recordSuccess(user.id)
      this.logger.success(`PIN guard cleared (auth:pin:* for user #${user.id})`)
    }

    if (this.reactivate && user.status === UserStatus.BLOCKED) {
      user.status = UserStatus.ACTIVE
      await userRepository.save(user)
      this.logger.success(`Account reactivated (status=ACTIVE)`)
    } else if (this.reactivate && user.status !== UserStatus.BLOCKED) {
      this.logger.info(`Account is not blocked (status=${user.status}) — no change`)
    } else if (!this.reactivate && user.status === UserStatus.BLOCKED) {
      this.logger.warning('Account is BLOCKED. Pass --reactivate if you also want to re-enable it.')
    }
  }
}
