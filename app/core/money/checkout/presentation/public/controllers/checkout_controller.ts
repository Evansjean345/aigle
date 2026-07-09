import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InitiateCheckoutUseCase from '#core/money/checkout/application/use_cases/initiate_checkout.use_case'
import GetCheckoutStatusUseCase from '#core/money/checkout/application/use_cases/get_checkout_status.use_case'
import GetPaymentOptionsByServiceTypeUseCase from '#core/catalog/catalogs/application/use_cases/get_payment_options_by_service_type.use_case'
import { initiateCheckoutValidator } from '#core/money/checkout/presentation/public/validators/checkout_validators'

/**
 * Paiement marchand (checkout) — surface **publique** consommée par la page de paiement
 * aigleplay. Le payeur n'est pas forcément un utilisateur Aigle : aucune authentification.
 * Le compte marchand est résolu côté serveur (jamais exposé).
 */
@inject()
export default class CheckoutController {
  constructor(
    private readonly initiateCheckout: InitiateCheckoutUseCase,
    private readonly getStatus: GetCheckoutStatusUseCase,
    private readonly paymentOptions: GetPaymentOptionsByServiceTypeUseCase
  ) {}

  /** Options de paiement `checkout` (catalogue business) pour la page aigleplay. */
  async options({ response }: HttpContext): Promise<void> {
    const result = await this.paymentOptions.execute('checkout')
    return response.ok(result)
  }

  /** Initie un paiement vers le marchand du `code`. Async → PENDING. */
  async initiate({ params, request, response, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(initiateCheckoutValidator)

    const result = await this.initiateCheckout.execute({
      code: params.code as string,
      amount: payload.amount,
      providerCode: payload.provider_code,
      paymentMethodCode: payload.payment_method_code,
      phone: payload.phone,
      country: payload.country,
      otp: payload.otp,
      geoIpLocation: geoLocation,
    })

    return response.created(result)
  }

  /** État d'un checkout par référence (polling). */
  async status({ params, response }: HttpContext): Promise<void> {
    const result = await this.getStatus.execute(params.reference as string)
    return response.ok(result)
  }
}
