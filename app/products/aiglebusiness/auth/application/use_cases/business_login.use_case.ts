import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import PinVerificationService from '#core/identity/authentication/application/services/pin_verification_service'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import BusinessLoginOtpTemplate from '#aiglebusiness/auth/domain/templates/business_login_otp_template'
import { type BusinessLoginRequestDto } from '#aiglebusiness/auth/application/dtos/business_auth.dto'
import InvalidCredentialsException from '#aiglebusiness/auth/domain/exceptions/invalid_credentials_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'

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

    // PIN faux → réponse générique (anti-énumération) ; le blocage se propage tel quel.
    try {
      await this.pinVerification.verify(user.userId, request.pincode)
    } catch (error) {
      if (error instanceof InvalidPincodeException) {
        throw new InvalidCredentialsException()
      }
      throw error
    }

    // Mobile : enregistre l'appareil en PENDING (déclenche l'alerte « nouvel appareil »).
    if (request.deviceInfo) {
      await this.deviceService.registerForApp(
        request.deviceInfo,
        user.userId,
        AppName.AIGLEBUSINESS
      )
    }

    await this.otpSending.send(user.phone, user.userId, new BusinessLoginOtpTemplate())
  }
}
