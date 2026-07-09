import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import PinVerificationService from '#core/identity/authentication/application/services/pin_verification_service'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { ClientChannel } from '#core/identity/authentication/domain/enums/client_channel'
import BusinessLoginOtpTemplate from '#aiglebusiness/auth/domain/templates/business_login_otp_template'
import { type BusinessLoginRequestDto } from '#aiglebusiness/auth/application/dtos/business_auth.dto'
import InvalidCredentialsException from '#aiglebusiness/auth/domain/exceptions/invalid_credentials_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import BusinessDeviceRequiredException from '#aiglebusiness/auth/domain/exceptions/business_device_required_exception'
import securityLog from '#shared/infrastructure/logging/security_log'
import { maskPhone } from '#shared/utils/utiles'

/**
 * Étape 1 du login business : résout l'utilisateur par téléphone, valide le PIN
 * (service core), enregistre l'appareil en PENDING (mobile, si `deviceInfo`), puis
 * envoie l'OTP de connexion. Aucun token émis à ce stade. Consomme le core
 * uniquement par services (invariant produit→core).
 */
@inject()
export default class BusinessLoginUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryService,
    private readonly pinVerification: PinVerificationService,
    private readonly otpSending: OtpSendingService,
    private readonly deviceService: DeviceService
  ) {}

  async execute(request: BusinessLoginRequestDto): Promise<void> {
    const user = await this.userDirectory.findByPhone(request.phone)

    if (!user) {
      throw new InvalidCredentialsException()
    }

    try {
      await this.pinVerification.verify(user.userId, request.pincode)
    } catch (error) {
      if (error instanceof InvalidPincodeException) {
        throw new InvalidCredentialsException()
      }
      throw error
    }

    securityLog.info(
      'BUSINESS_LOGIN_ATTEMPT',
      { userId: user.userId, phone: maskPhone(user.phone), channel: request.channel },
      'Business login step 1 (PIN validated, OTP dispatch)'
    )

    if (request.channel === ClientChannel.MOBILE) {
      if (!request.deviceInfo) {
        throw new BusinessDeviceRequiredException()
      }
      await this.deviceService.registerForApp(
        request.deviceInfo,
        user.userId,
        AppName.AIGLEBUSINESS
      )
    }

    await this.otpSending.send(user.phone, user.userId, new BusinessLoginOtpTemplate())
  }
}
