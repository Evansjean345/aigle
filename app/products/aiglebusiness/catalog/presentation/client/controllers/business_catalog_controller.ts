import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetPaymentOptionsByServiceTypeUseCase from '#core/catalog/catalogs/application/use_cases/get_payment_options_by_service_type.use_case'
import GetToPaymentOptionsByServiceTypeUseCase from '#core/catalog/catalogs/application/use_cases/get_to_payment_options_by_service_type.use_case'

/**
 * Catalogue (canal business). Présentation **mince** : expose au canal business les mêmes
 * options de paiement/transfert que le mobile aiglesend (`/mobile/services/payment-options`),
 * en déléguant aux **use cases core** du catalogue (produit → core par l'application core).
 *
 * Permet à l'app business de charger la liste des catalogues de transfert (méthodes + providers,
 * frais, minAmount…) par type de service (`wallet_transfert`, `transfert`, `inter_reseau`…).
 */
@inject()
export default class BusinessCatalogController {
  constructor(
    private readonly getPaymentOptions: GetPaymentOptionsByServiceTypeUseCase,
    private readonly getToPaymentOptions: GetToPaymentOptionsByServiceTypeUseCase
  ) {}

  /** GET /business/services/payment-options/:serviceType — options groupées par méthode/provider. */
  async paymentOptionsByServiceType({ params, response }: HttpContext): Promise<void> {
    const serviceTypeCode = params.serviceType as string
    const result = await this.getPaymentOptions.execute(serviceTypeCode)
    return response.ok(result)
  }

  /**
   * GET /business/services/payment-options/:serviceType/to?fromProviderCode= —
   * options de **destination** (inter-réseau) filtrées par le provider source.
   */
  async paymentOptionsByServiceTypeTo({ params, request, response }: HttpContext): Promise<void> {
    const serviceTypeCode = params.serviceType as string
    const fromProviderCode = request.qs().fromProviderCode as string | undefined

    if (!fromProviderCode) {
      return response.badRequest({
        code: 'FROM_PROVIDER_REQUIRED',
        message: 'fromProviderCode is required',
      })
    }

    const result = await this.getToPaymentOptions.execute(serviceTypeCode, fromProviderCode)
    return response.ok(result)
  }
}
