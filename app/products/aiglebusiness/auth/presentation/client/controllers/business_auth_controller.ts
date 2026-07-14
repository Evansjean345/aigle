import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CheckBusinessPhoneUseCase from '#aiglebusiness/auth/application/use_cases/check_business_phone.use_case'
import BusinessLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_login.use_case'
import BusinessVerifyLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_verify_login.use_case'
import CheckPinUseCase from '#core/identity/authentication/application/use_cases/check_pin_use_case'
import User from '#core/identity/user/domain/models/user'
import { type BusinessAuthTraceContext } from '#aiglebusiness/auth/application/business_auth_audit'
import {
  businessCheckPhoneValidator,
  businessLoginValidator,
  businessVerifyLoginValidator,
  businessCheckPinValidator,
} from '#aiglebusiness/auth/presentation/client/validators/business_auth_validators'

@inject()
export default class BusinessAuthController {
  constructor(
    private readonly checkBusinessPhone: CheckBusinessPhoneUseCase,
    private readonly businessLogin: BusinessLoginUseCase,
    private readonly businessVerifyLogin: BusinessVerifyLoginUseCase,
    private readonly checkPin: CheckPinUseCase
  ) {}

  /**
   * Contexte de requête pour l'audit : canal (garanti par le middleware businessChannel/
   * businessDevice), IP (via géoloc comme aiglesend, repli request.ip()), UA, requestId.
   */
  private traceContext(ctx: HttpContext): BusinessAuthTraceContext {
    const { request, clientChannel, geoLocation } = ctx
    return {
      channel: clientChannel!,
      ipAddress: geoLocation?.ip ?? request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    }
  }

  /** Étape 0 : vérifie que le numéro est un user Aigle KYC-vérifié (→ 404/403 sinon). */
  async checkPhone(ctx: HttpContext): Promise<void> {
    const { request, response } = ctx
    const payload = await request.validateUsing(businessCheckPhoneValidator)
    const result = await this.checkBusinessPhone.execute(payload.phone, this.traceContext(ctx))
    return response.ok(result)
  }

  async login(ctx: HttpContext): Promise<void> {
    const { request, response } = ctx
    const payload = await request.validateUsing(businessLoginValidator)
    await this.businessLogin.execute(
      { phone: payload.phone, pincode: payload.pincode, deviceInfo: payload.device_info },
      this.traceContext(ctx)
    )

    return response.ok({ message: 'Un code de connexion a été envoyé par SMS.' })
  }

  async verify(ctx: HttpContext): Promise<void> {
    const { request, response, deviceInfo } = ctx
    const payload = await request.validateUsing(businessVerifyLoginValidator)

    const result = await this.businessVerifyLogin.execute(
      {
        phone: payload.phone,
        otp: payload.otp,
        sessionName: request.header('user-agent')?.slice(0, 120),
        deviceFingerprint: deviceInfo?.fingerprintHash || undefined,
        deviceUid: deviceInfo?.deviceUid || undefined,
      },
      this.traceContext(ctx)
    )

    return response.ok(result)
  }

  /**
   * Vérifie le PIN de l'utilisateur **authentifié** (déverrouillage / lock-screen).
   * Miroir d'aiglesend (`check-pin`) : délègue au use case core `CheckPinUseCase`
   * (mêmes garanties — `PinAttemptGuard` : blocage/temporisation, audit). Le numéro
   * vient du token (pas du corps) ; le compte marchand ne s'authentifie pas, c'est
   * son propriétaire (user) qui saisit le PIN.
   */
  async checkPinCode(ctx: HttpContext): Promise<void> {
    const { request, response, geoLocation } = ctx
    const payload = await request.validateUsing(businessCheckPinValidator)
    const user = ctx.auth.user! as User

    const result = await this.checkPin.execute({
      phone: user.phone,
      pincode: payload.pincode,
      ipAddress: geoLocation?.ip ?? request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })

    return response.created({ isValid: result })
  }
}
