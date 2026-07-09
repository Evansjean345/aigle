import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import BusinessLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_login.use_case'
import BusinessVerifyLoginUseCase from '#aiglebusiness/auth/application/use_cases/business_verify_login.use_case'
import {
  businessLoginValidator,
  businessVerifyLoginValidator,
} from '#aiglebusiness/auth/presentation/client/validators/business_auth_validators'

/**
 * Authentification du portail/app business (canal client). Flux en 2 temps :
 * `login` (phone+PIN → OTP), `verify` (phone+OTP → token stampé `app:aiglebusiness`).
 * Routes publiques (aucun token encore).
 */
@inject()
export default class BusinessAuthController {
  constructor(
    private readonly businessLogin: BusinessLoginUseCase,
    private readonly businessVerifyLogin: BusinessVerifyLoginUseCase
  ) {}

  /** Étape 1 : valide le PIN et envoie l'OTP. */
  async login({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(businessLoginValidator)
    await this.businessLogin.execute({ phone: payload.phone, pincode: payload.pincode })

    return response.ok({ message: 'Un code de connexion a été envoyé par SMS.' })
  }

  /** Étape 2 : vérifie l'OTP et émet le token. */
  async verify({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(businessVerifyLoginValidator)

    const result = await this.businessVerifyLogin.execute({
      phone: payload.phone,
      otp: payload.otp,
      // Libellé de session (Lot 3) : le navigateur/app d'origine.
      sessionName: request.header('user-agent')?.slice(0, 120),
    })

    return response.ok(result)
  }
}
