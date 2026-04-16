import { inject } from '@adonisjs/core'
import { LoginRequestDto, LoginResult } from '#features/authentication/application/dtos/login.dto'
import OtpSendingService from '#features/otp/application/services/otp_sending_service'
import DeviceService from '#features/device/application/services/device_service'
import { DeviceCommandDTO } from '#features/device/application/dto/device.command.dto'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber, maskPhone } from '#shared/utils/utiles'
import User from '#features/user/domain/models/user'
import { UserStatus } from '#features/user/domain/enum'
import AccountBlockedException from '#features/authentication/infrastructure/exceptions/account_blocked_exception'
import securityLog from '#shared/infrastructure/logging/security_log'

@inject()
export default class VerifyCredentialsUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {CountryRepository} countryRepository - The repository for country data management.
   * @param {OtpService} otpService - The OTP (One-Time Password) service used for handling OTP-related functionalities.
   * @param {DeviceService} deviceService - The device service used for managing device registration.
   */
  constructor(
    protected countryRepository: CountryRepository,
    private otpSendingService: OtpSendingService,
    private deviceService: DeviceService
  ) {}

  /**
   * Executes the login process by delegating to the authentication service.
   *
   * @param {LoginRequestDto} data - The login request data containing credentials.
   * @return {Promise<LoginResult>} A promise that resolves to the result of the login operation.
   */
  async execute(data: LoginRequestDto): Promise<LoginResult> {
    const country = await this.countryRepository.findCountryBy('id', data.country_id)
    const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

    const user = await User.verifyCredentials(formattedPhone, data.pincode)

    if (user.status === UserStatus.BLOCKED) {
      securityLog.warn(
        'ACCOUNT_BLOCKED_LOGIN_ATTEMPT',
        { userId: user.id, phone: formattedPhone },
        'Blocked account login attempt'
      )
      throw new AccountBlockedException()
    }

    if (data.device) {
      const deviceCommand = DeviceCommandDTO.fromRequest(data.device)
      await this.deviceService.saveDevice(deviceCommand, user.usersUid)
    }

    securityLog.info(
      'USER_CREDENTIALS_VERIFIED',
      { userId: user.id, phone: maskPhone(formattedPhone) },
      'User credentials verified, proceeding to OTP'
    )

    if (bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview) {
      return { message: 'Bypass OTP activé pour ce numéro' }
    }

    await this.otpSendingService.send(user.phone, user.usersUid)
    return { message: 'OTP sent successfully' }
  }
}
