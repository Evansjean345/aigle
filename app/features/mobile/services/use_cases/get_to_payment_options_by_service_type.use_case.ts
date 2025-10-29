import { inject } from '@adonisjs/core'
import MobileServicesService from '#mobile/services/services/mobile_services_service'
import { PaymentOptionsByServiceTypeResult } from '#mobile/services/dtos/payment_options_by_service_type.result'

@inject()
/**
 * Use case for retrieving destination providers for a given service type and origin provider.
 */
export default class GetToPaymentOptionsByServiceTypeUseCase {
  /**
   * Constructs a new instance of the class.
   *
   * @param {MobileServicesService} service - The service instance to be used by the class.
   */
  constructor(private readonly service: MobileServicesService) {}

  /**
   * Executes the retrieval of payment options based on the provided service type code
   * and provider code.
   *
   * @param {string} serviceTypeCode - The code representing the type of service.
   * @param {string} fromProviderCode - The code representing the originating provider.
   * @return {Promise<PaymentOptionsByServiceTypeResult>} A promise that resolves with
   * the payment options result for the given service type and provider.
   */
  async execute(
    serviceTypeCode: string,
    fromProviderCode: string
  ): Promise<PaymentOptionsByServiceTypeResult> {
    return this.service.getToPaymentOptionsByServiceType(serviceTypeCode, fromProviderCode)
  }
}
