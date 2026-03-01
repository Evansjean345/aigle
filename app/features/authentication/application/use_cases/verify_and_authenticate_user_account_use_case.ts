import OtpService from '#features/authentication/application/services/otp_service'
import User from '#features/user/domain/models/user'
import { AuthenticatedProfileAndTokenResponseDto } from '#features/authentication/application/dtos/profile.dto'
import { toAuthenticatedUserProfileAndTokenResponse } from '#features/authentication/application/mappers/authenticated_user.mapper'
import { inject } from '@adonisjs/core'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber, maskPhone } from '#shared/utils/utiles'
import { UserStatus } from '#features/user/domain/enum'
import { VerifyAccountRequestDto } from '#features/authentication/application/dtos/verify_account.dto'
import DeviceService from '#features/device/application/services/device_service'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import PhoneNotFoundException from '#features/authentication/infrastructure/exceptions/phone_not_found_exception'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import AccountBlockedException from '#features/authentication/infrastructure/exceptions/account_blocked_exception'
import securityLog from '#shared/infrastructure/logging/security_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import emitter from '@adonisjs/core/services/emitter'
import AccountVerified from '#features/authentication/application/events/account_verified'

/**
 * Interface pour les informations device passées au use case
 */
export interface DeviceInfoPayload {
  fingerprintHash: string | null
  deviceUid: string | null
  platform: string | null
  appVersion: string | null
  osVersion: string | null
  clientIp: string | null
}

@inject()
export default class VerifyAndAuthenticateUserAccountUseCase {
  /**
   * Initializes a new instance of the class with the specified dependencies.
   *
   * @param {UserRepository} userRepository - The repository used for user data management.
   * @param {OtpService} otpService - The service used for managing one-time password (OTP) functionalities.
   * @param {CountryRepository} countryRepository - The repository used for accessing and managing country-related data.
   * @param {DeviceService} deviceService - The service used for managing device-related operations.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: OtpService,
    private readonly countryRepository: CountryRepository,
    private readonly deviceService: DeviceService
  ) {}

  /**
   * Executes the OTP verification process by validating the provided phone number and PIN code.
   *
   * @param {VerifyAccountRequestDto} payload - The input data required for OTP verification.
   * @param type - The type of verification (register or login).
   * @param deviceInfo - The device information from the request headers.
   * @return {Promise<AuthenticatedProfileAndTokenResponseDto>} A promise that resolves when the OTP verification process completes successfully.
   */
  async execute(
    payload: VerifyAccountRequestDto,
    type: 'register' | 'login',
    deviceInfo?: DeviceInfoPayload
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
      throw new AccountBlockedException()
    }

    try {
      if (!this.shouldBypassOtpVerification(user)) {
        await this.otpService.verifyOtp({ identifier: user.phone, enteredOtp: payload.otp })
      }

      if (type === 'register' && user.status === UserStatus.INACTIVE) {
        user.status = UserStatus.ACTIVE
        await this.userRepository.save(user)

        await emitter.emit(new AccountVerified(user.usersUid, user.phone))
      }

      let device

      if (deviceInfo?.fingerprintHash && deviceInfo?.deviceUid) {
        device = await this.deviceService.trustDeviceByFingerprintAndUid(
          user.usersUid,
          deviceInfo.fingerprintHash,
          deviceInfo.deviceUid,
          deviceInfo.clientIp ?? undefined
        )
      }

      const token = await User.accessTokens.create(user, ['*'], {
        name: device ? `device:${device.id}` : 'unknown_device',
      })

      securityLog.info(
        'USER_AUTHENTICATED',
        {
          userId: user.id,
          phone: maskPhone(user.phone),
          type,
          deviceId: device?.id,
        },
        'User successfully authenticated'
      )

      await user.load('country')
      await user.load('wallet')
      await user.load('kycDocument')

      return toAuthenticatedUserProfileAndTokenResponse(user, token.value!.release())
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
      throw error
    }
  }

  /**
   * Determines whether the OTP verification process should be bypassed for a given user.
   *
   * @param user - The user object containing details about the user.
   * @return A boolean value indicating whether the OTP verification should be bypassed.
   */
  private shouldBypassOtpVerification(user: User): boolean {
    return Boolean(bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview)
  }
}
