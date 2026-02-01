import { inject } from '@adonisjs/core'
import { LoginRequestDto, LoginResult } from '#features/authentication/application/dtos/login.dto'
import OtpService from '#features/authentication/application/services/otp_service'
import DeviceService from '#features/device/application/services/device_service'
import { toDeviceCommand } from '#features/device/application/mappers/device.mapper'
import { bypassEnabled, appPhoneNumberReview } from '#config/app'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { concartPhoneNumber } from '#shared/utils/utiles'
import User from '#features/user/domain/models/user'
import { UserStatus } from '#features/user/domain/enum'
import AccountBlockedException from '#features/authentication/infrastructure/exceptions/account_blocked_exception'

@inject()
export default class LoginUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {CountryRepository} countryRepository - The repository for country data management.
   * @param {OtpService} otpService - The OTP (One-Time Password) service used for handling OTP-related functionalities.
   * @param {DeviceService} deviceService - The device service used for managing device registration.
   */
  constructor(
    protected countryRepository: CountryRepository,
    private otpService: OtpService,
    private deviceService: DeviceService
  ) {}

  /**
   * Executes the login process by delegating to the authentication service.
   *
   * @param {LoginRequestDto} data - The login request data containing credentials.
   * @return {Promise<LoginResult>} A promise that resolves to the result of the login operation.
   */
  async execute(data: LoginRequestDto): Promise<LoginResult> {
    try {
      const country = await this.countryRepository.findCountryBy('id', data.country_id)
      const formattedPhone = concartPhoneNumber(country.phoneCode, data.phone)

      const user = await User.verifyCredentials(formattedPhone, data.pincode)

      if (user.status === UserStatus.BLOCKED) {
        throw new AccountBlockedException()
      }

      if (data.device) {
        const deviceCommand = await toDeviceCommand(data.device)
        await this.deviceService.saveDevice(deviceCommand, user.usersUid)
      }

      if (bypassEnabled && appPhoneNumberReview && user.phone === appPhoneNumberReview) {
        return { message: 'Bypass OTP activé pour ce numéro' }
      }

      await this.otpService.sendOtp(user.phone, user.usersUid)
      return { message: 'OTP sent successfully' }
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}
