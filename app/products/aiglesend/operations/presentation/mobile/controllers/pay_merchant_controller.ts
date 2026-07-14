import { HttpContext } from '@adonisjs/core/http'
import User from '#core/identity/user/domain/models/user'
import { inject } from '@adonisjs/core'
import PayMerchantUseCase from '#aiglesend/operations/application/use_cases/pay_merchant.use_case'
import { payMerchantValidator } from '#aiglesend/operations/presentation/mobile/validators/pay_merchant_validator'
import { PayMerchantRequestDto } from '#aiglesend/operations/application/dtos/pay_merchant.dto'

/**
 * Controller du paiement marchand depuis le wallet aiglesend (scan du QR marchand).
 */
@inject()
export default class PayMerchantController {
  constructor(private readonly payMerchantUseCase: PayMerchantUseCase) {}

  /**
   * Valide le payload, réduit l'utilisateur authentifié à l'acteur produit, et exécute le paiement.
   */
  async handle({ request, response, auth, deviceInfo, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(payMerchantValidator)

    const user = auth.user! as User
    const idempotencyKey = request.header('X-Idempotency-Key')

    const dto = PayMerchantRequestDto.fromRequest(payload, deviceInfo, geoLocation, {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })

    const result = await this.payMerchantUseCase.execute(dto, user, idempotencyKey)
    return response.ok(result)
  }
}
