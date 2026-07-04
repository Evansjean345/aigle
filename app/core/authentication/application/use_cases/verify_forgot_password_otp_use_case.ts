import { inject } from '@adonisjs/core'
import OtpVerificationService from '#core/otp/application/services/otp_verification_service'
import CountryRepository from '#core/country/domain/interfaces/country_repository'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import ResetPasswordTokenProvider from '#core/authentication/domain/interfaces/reset_password_token_provider'
import { VerifyAccountRequestDto } from '#core/authentication/application/dtos/verify_account.dto'
import { concartPhoneNumber } from '#shared/utils/utiles'
import PhoneNotFoundException from '#core/authentication/infrastructure/exceptions/phone_not_found_exception'
import { randomUUID } from 'node:crypto'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import User from '#core/user/domain/models/user'
import UserOtpAttemptGuard from '#core/authentication/application/services/user_otp_attempt_guard'
import OtpLockedException from '#core/otp/infrastructure/exceptions/otp_locked_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class VerifyForgotPasswordOtpUseCase {
  /**
   * Constructs an instance of the class with the required dependencies.
   *
   * @param {UserRepository} userRepository - The repository used for managing user data.
   * @param otpVerificationService
   * @param {CountryRepository} countryRepository - The repository used for accessing country-specific data.
   * @param {ResetPasswordTokenProvider} resetPasswordTokenProvider - The provider used for managing reset password tokens.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpVerificationService: OtpVerificationService,
    private readonly countryRepository: CountryRepository,
    private readonly resetPasswordTokenProvider: ResetPasswordTokenProvider,
    private readonly otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Executes the account verification process. It validates the provided phone number
   * and OTP, generates a reset token, and stores it with a time-to-live (TTL).
   *
   * @param {VerifyAccountRequestDto} payload - The data required for verification,
   * including country ID, phone number, and OTP.
   * @returns {Promise<{ reset_token: string }>} A promise resolving with an object
   * containing the generated reset token.
   * @throws {PhoneNotFoundException} If the phone number does not belong to any user.
   */
  async execute(payload: VerifyAccountRequestDto): Promise<{ reset_token: string }> {
    const country = await this.countryRepository.findCountryBy('id', payload.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, payload.phone)
    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    if (!this.shouldBypassOtpVerification(user)) {
      // Block before probing — prevents an attacker from testing codes
      // during a temporary lockout window.
      await this.otpAttemptGuard.assertNotBlocked(user)
    }

    try {
      if (!this.shouldBypassOtpVerification(user)) {
        try {
          await this.otpVerificationService.verify({
            identifier: user.phone,
            enteredOtp: payload.otp,
          })
        } catch (otpError) {
          // Only count fully-exhausted OTPs as brute-force attempts at the
          // user scope; typos are already throttled per-OTP.
          if (otpError instanceof OtpLockedException) {
            await this.otpAttemptGuard.recordFailure(user, payload.ipAddress ?? null)
          }
          throw otpError
        }

        await this.otpAttemptGuard.recordSuccess(user.id)
      }
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_FORGOT_PASSWORD_OTP_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode: 'INVALID_OTP',
          errorMessage: (error as Error).message,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
          requestId: payload.requestId ?? null,
          metadata: {
            geoCountry: payload.geoLocation?.countryCode ?? null,
            geoCity: payload.geoLocation?.city ?? null,
            isVpn: payload.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw error
    }

    const resetToken = randomUUID()
    await this.resetPasswordTokenProvider.store(user.phone, resetToken, 600) // 10 seconds TTL

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_FORGOT_PASSWORD_OTP_VERIFIED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        requestId: payload.requestId ?? null,
        metadata: {
          geoCountry: payload.geoLocation?.countryCode ?? null,
          geoCity: payload.geoLocation?.city ?? null,
          isVpn: payload.geoLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})

    return { reset_token: resetToken }
  }

  /**
   * Determines if the OTP verification should be bypassed for the given user.
   *
   * @param {User} user - The user object containing relevant information about the user.
   * @return {boolean} Returns `true` if OTP verification should be bypassed; otherwise, `false`.
   */
  private shouldBypassOtpVerification(user: User): boolean {
    return Boolean(bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview)
  }
}
