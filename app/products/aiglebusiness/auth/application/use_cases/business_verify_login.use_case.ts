import { inject } from '@adonisjs/core'
import UserDirectoryService from '#core/identity/user/application/services/user_directory_service'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import IssueAppTokenService from '#core/identity/authentication/application/services/issue_app_token_service'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import BusinessLoginOtpTemplate from '#aiglebusiness/auth/domain/templates/business_login_otp_template'
import {
  type BusinessVerifyLoginRequestDto,
  BusinessAuthTokenDTO,
} from '#aiglebusiness/auth/application/dtos/business_auth.dto'
import InvalidCredentialsException from '#aiglebusiness/auth/domain/exceptions/invalid_credentials_exception'

/**
 * Étape 2 du login business : vérifie l'OTP puis émet un token **stampé
 * `app:aiglebusiness`** via le service core (le produit ne touche pas le modèle
 * User). Renvoie le token + un profil minimal.
 */
@inject()
export default class BusinessVerifyLoginUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryService,
    private readonly otpVerification: OtpVerificationService,
    private readonly issueAppToken: IssueAppTokenService,
    private readonly deviceService: DeviceService
  ) {}

  async execute(request: BusinessVerifyLoginRequestDto): Promise<BusinessAuthTokenDTO> {
    const user = await this.userDirectory.findByPhone(request.phone)

    if (!user) {
      throw new InvalidCredentialsException()
    }

    await this.otpVerification.verify(
      { identifier: user.phone, enteredOtp: request.otp },
      new BusinessLoginOtpTemplate()
    )

    // Mobile business : truste l'appareil déjà enregistré (PENDING) à l'étape login.
    // Fingerprint + uid viennent des HEADERS device. Token nommé `device:<id>`.
    let tokenName = request.sessionName

    if (request.deviceFingerprint && request.deviceUid) {
      const trusted = await this.deviceService.trustForApp(
        request.deviceFingerprint,
        request.deviceUid,
        user.userId,
        AppName.AIGLEBUSINESS
      )

      if (trusted) {
        tokenName = `device:${trusted.userDeviceId}`
      }
    }

    const token = await this.issueAppToken.issue(user.userId, AppName.AIGLEBUSINESS, {
      name: tokenName,
      channel: request.channel,
    })

    return BusinessAuthTokenDTO.from(token, user)
  }
}
