import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CheckBusinessPhoneUseCase from '#aiglebusiness/auth/application/use_cases/check_business_phone.use_case'
import BusinessLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_login.use_case'
import BusinessVerifyLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_verify_login.use_case'
import {
  businessCheckPhoneValidator,
  businessLoginValidator,
  businessVerifyLoginValidator,
} from '#aiglebusiness/auth/presentation/client/validators/business_auth_validators'

@inject()
export default class BusinessAuthController {
  constructor(
    private readonly checkBusinessPhone: CheckBusinessPhoneUseCase,
    private readonly businessLogin: BusinessLoginUseCase,
    private readonly businessVerifyLogin: BusinessVerifyLoginUseCase
  ) {}

  /** Étape 0 : vérifie que le numéro est un user Aigle KYC-vérifié (→ 404/403 sinon). */
  async checkPhone({ request, response, clientChannel }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(businessCheckPhoneValidator)
    // Canal garanti par le middleware businessChannel (400 sinon) — pour le traçage.
    const result = await this.checkBusinessPhone.execute(payload.phone, clientChannel!)
    return response.ok(result)
  }

  async login({ request, response, clientChannel }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(businessLoginValidator)
    await this.businessLogin.execute({
      phone: payload.phone,
      pincode: payload.pincode,
      // Canal garanti par le middleware businessChannel (400 sinon).
      channel: clientChannel!,
      deviceInfo: payload.device_info,
    })

    return response.ok({ message: 'Un code de connexion a été envoyé par SMS.' })
  }

  async verify({ request, response, deviceInfo, clientChannel }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(businessVerifyLoginValidator)

    const result = await this.businessVerifyLogin.execute({
      phone: payload.phone,
      otp: payload.otp,
      // Canal garanti par le middleware businessDevice (400 sinon).
      channel: clientChannel!,
      sessionName: request.header('user-agent')?.slice(0, 120),
      // Appareil via HEADERS (middleware businessDevice) : fingerprint + uid pour le trust.
      deviceFingerprint: deviceInfo?.fingerprintHash || undefined,
      deviceUid: deviceInfo?.deviceUid || undefined,
    })

    return response.ok(result)
  }
}
