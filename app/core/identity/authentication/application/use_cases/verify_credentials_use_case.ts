import { inject } from '@adonisjs/core'
import {
  LoginRequestDto,
  LoginResult,
} from '#core/identity/authentication/application/dtos/login.dto'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { DeviceCommandDTO } from '#core/identity/device/application/dtos/device.command.dto'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import CountryRepository from '#core/catalog/country/domain/interfaces/country_repository'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import PinAttemptGuard from '#core/identity/authentication/application/services/pin_attempt_guard'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import hash from '@adonisjs/core/services/hash'
import { concartPhoneNumber, maskPhone } from '#shared/utils/utiles'
import securityLog from '#shared/infrastructure/logging/security_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class VerifyCredentialsUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {CountryRepository} countryRepository - Repository for accessing country data.
   * @param {OtpSendingService} otpSendingService - Service responsible for sending one-time passwords.
   * @param {DeviceService} deviceService - Service for managing device information and operations.
   * @param {UserRepository} userRepository - Repository for accessing user data.
   * @param {PinAttemptGuard} pinAttemptGuard - Guard for validating and limiting PIN entry attempts.
   */
  constructor(
    protected countryRepository: CountryRepository,
    private otpSendingService: OtpSendingService,
    private deviceService: DeviceService,
    private userRepository: UserRepository,
    private pinAttemptGuard: PinAttemptGuard,
    private otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Executes the user login process by formatting the phone number, verifying the user exists,
   * checking for account blocks, validating the PIN code, and sending an OTP. Handles audit
   * logging for both successful and failed attempts, manages PIN attempt tracking, and
   * optionally saves device information.
   *
   * @param {LoginRequestDto} data - The login request data including country ID, phone, PIN, and optional device and request metadata.
   * @return {Promise<LoginResult>} A promise resolving to a LoginResult object containing a message regarding the OTP status.
   */
  async execute(data: LoginRequestDto): Promise<LoginResult> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

    const user = await this.userRepository.findByPhone(formattedPhone)

    if (!user) {
      throw new PhoneNotFoundException()
    }

    try {
      await this.pinAttemptGuard.assertNotBlocked(user)
    } catch (error) {
      const errorCode =
        error instanceof AccountBlockedException ? 'ACCOUNT_BLOCKED' : 'PIN_TEMPORARILY_BLOCKED'

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_LOGIN_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode,
          errorMessage: (error as Error).message,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(formattedPhone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw error
    }

    if (!(await hash.verify(user.pincode, data.pincode))) {
      await this.pinAttemptGuard.recordFailure(user)

      emitter
        .emit('activity:audit', {
          eventCategory: 'AUTH',
          eventAction: 'USER_LOGIN_FAILED',
          actorId: String(user.id),
          actorType: 'User',
          targetType: 'User',
          targetId: String(user.id),
          result: AuditResult.FAILURE,
          errorCode: 'INVALID_CREDENTIALS',
          errorMessage: 'Invalid phone or PIN',
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          requestId: data.requestId ?? null,
          metadata: {
            phone: maskPhone(formattedPhone),
            geoCountry: data.geoLocation?.countryCode ?? null,
            geoCity: data.geoLocation?.city ?? null,
            isVpn: data.geoLocation?.isVpn ?? null,
          },
        })
        .catch(() => {})

      throw new InvalidPincodeException()
    }

    await this.pinAttemptGuard.recordSuccess(user.id)

    if (data.device) {
      const deviceCommand = DeviceCommandDTO.fromRequest(data.device)
      await this.deviceService.saveDevice(deviceCommand, user.usersUid, AppName.AIGLESEND)
    }

    securityLog.info(
      'USER_CREDENTIALS_VERIFIED',
      { userId: user.id, phone: maskPhone(formattedPhone) },
      'User credentials verified, proceeding to OTP'
    )

    emitter
      .emit('activity:audit', {
        eventCategory: 'AUTH',
        eventAction: 'USER_LOGIN_SUCCESS',
        actorId: String(user.id),
        actorType: 'User',
        actorRole: 'User',
        targetType: 'User',
        targetId: String(user.id),
        result: AuditResult.SUCCESS,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
        metadata: {
          geoCountry: data.geoLocation?.countryCode ?? null,
          geoCity: data.geoLocation?.city ?? null,
          isVpn: data.geoLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})

    if (bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview) {
      return { message: 'Bypass OTP activé pour ce numéro' }
    }

    // Block at the dispatch boundary too — without this, an attacker locked
    // by the verify-side guard could keep regenerating SMS OTPs by submitting
    // valid credentials repeatedly (cost + harassment of the legitimate user).
    await this.otpAttemptGuard.assertNotBlocked(user)

    await this.otpSendingService.send(user.phone, user.usersUid)
    return { message: 'OTP sent successfully' }
  }
}
