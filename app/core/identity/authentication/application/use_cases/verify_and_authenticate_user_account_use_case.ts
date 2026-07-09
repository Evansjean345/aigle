import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import User from '#core/identity/user/domain/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#core/identity/authentication/application/dtos/profile.dto'
import { inject } from '@adonisjs/core'
import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import { concartPhoneNumber, maskPhone } from '#shared/utils/utiles'
import { UserStatus } from '#core/identity/user/domain/enum'
import { VerifyAccountRequestDto } from '#core/identity/authentication/application/dtos/verify_account.dto'
import DeviceService from '#core/identity/device/application/services/device_service'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import IssueAppTokenService from '#core/identity/authentication/application/services/issue_app_token_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import OtpLockedException from '#core/identity/otp/domain/exceptions/otp_locked_exception'
import securityLog from '#shared/infrastructure/logging/security_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class VerifyAndAuthenticateUserAccountUseCase {
  /**
   * Constructs an instance of the class with the specified dependencies.
   *
   * @param {UserRepository} userRepository - The repository responsible for managing user-related data.
   * @param {OtpVerificationService} otpVerificationService - The service used for handling OTP verification processes.
   * @param {CountryRepository} countryRepository - The repository for accessing country-related information.
   * @param {DeviceService} deviceService - The service used for managing device-related operations.
   * @param {UserOtpAttemptGuard} otpAttemptGuard
   * @param issueAppTokenService
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpVerificationService: OtpVerificationService,
    private readonly countryRepository: CountryRepository,
    private readonly deviceService: DeviceService,
    private readonly otpAttemptGuard: UserOtpAttemptGuard,
    private readonly issueAppTokenService: IssueAppTokenService
  ) {}

  /**
   * Executes the account verification and authentication process based on the provided payload and type.
   *
   * @param {VerifyAccountRequestDto} payload - The payload containing account verification details such as country ID, phone number, OTP, and device info.
   * @param {'register' | 'login'} type - Specifies the type of operation being performed: "register" for user registration or "login" for user authentication.
   * @return {Promise<AuthenticatedProfileAndTokenResponseDto>} A promise that resolves to the authenticated user's profile and token details.
   * @throws {PhoneNotFoundException} If the user could not be found by the provided phone number.
   * @throws {AccountBlockedException} If the user's account is blocked and cannot proceed with authentication.
   * @throws {Error} If an error occurs during OTP verification or any other part of the process.
   */
  async execute(
    payload: VerifyAccountRequestDto,
    type: 'register' | 'login'
  ): Promise<AuthenticatedProfileAndTokenResponseDto> {
    const country = await this.countryRepository.findCountryBy('id', payload.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, payload.phone)
    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    if (user.status === UserStatus.BLOCKED) {
      securityLog.warn(
        'ACCOUNT_BLOCKED_AUTH_ATTEMPT',
        { userId: user.id, phone: formattedPhone },
        'Blocked account authentication attempt'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_OTP_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode: 'ACCOUNT_BLOCKED',
          errorMessage: 'Blocked account authentication attempt',
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

      throw new AccountBlockedException()
    }

    if (!this.shouldBypassOtpVerification(user)) {
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
          if (otpError instanceof OtpLockedException) {
            await this.otpAttemptGuard.recordFailure(user, payload.ipAddress ?? null)
          }
          throw otpError
        }

        await this.otpAttemptGuard.recordSuccess(user.id)
      }

      if (type === 'register' && user.status === UserStatus.INACTIVE) {
        user.status = UserStatus.ACTIVE
        await this.userRepository.save(user)
      }

      let userDevice

      if (payload.deviceInfo?.fingerprintHash && payload.deviceInfo?.deviceUid) {
        userDevice = await this.deviceService.trustDevice(
          user.usersUid,
          payload.deviceInfo.fingerprintHash,
          payload.deviceInfo.deviceUid,
          payload.geoLocation as GeoIpLocation,
          AppName.AIGLESEND
        )
      }

      const tokenValue = await this.issueAppTokenService.issueForUser(user, AppName.AIGLESEND, {
        name: userDevice ? `device:${userDevice.id}` : 'unknown_device',
      })

      securityLog.info(
        'USER_AUTHENTICATED',
        {
          userId: user.id,
          phone: maskPhone(user.phone),
          type,
          userDeviceId: userDevice?.id,
        },
        'User successfully authenticated'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_OTP_VERIFIED',
          actorId: String(user.id),
          actorType: 'User',
          actorRole: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.SUCCESS,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
          requestId: payload.requestId ?? null,
          metadata: {
            type,
            userDeviceId: userDevice?.id ?? null,
            geoCountry: payload.geoLocation?.countryCode ?? null,
            geoCity: payload.geoLocation?.city ?? null,
            isVpn: payload.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      await user.load('country')
      await user.load('wallet')
      await user.load('kycDocument')

      return AuthenticatedProfileAndTokenResponseDto.from(user, tokenValue)
    } catch (error) {
      errorLog.error(
        'AUTH_EXECUTE_ERROR',
        {
          userId: user.id,
          type,
          error: error.message,
        },
        'Error during authentication execution'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_OTP_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode: 'INVALID_OTP',
          errorMessage: error.message,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
          requestId: payload.requestId ?? null,
          metadata: {
            type,
            geoCountry: payload.geoLocation?.countryCode ?? null,
            geoCity: payload.geoLocation?.city ?? null,
            isVpn: payload.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw error
    }
  }

  /**
   *
   * @param user
   * @private
   */
  private shouldBypassOtpVerification(user: User): boolean {
    return Boolean(bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview)
  }
}
