import { inject } from '@adonisjs/core'
import MobileServicesService from '#features/appServices/presentation/mobile/services/mobile_services_service'
import { PaymentOptionsByServiceTypeResult } from '#features/appServices/presentation/mobile/dtos/payment_options_by_service_type.result'

@inject()
/**
 * A use case class responsible for retrieving payment options associated with a specific service type.
 */
export default class GetPaymentOptionsByServiceTypeUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {MobileServicesService} service - An instance of MobileServicesService to be used for mobile service operations.
   */
  constructor(private readonly service: MobileServicesService) {}

  /**
   * Executes a request to retrieve payment options for the given service type code.
   *
   * @param {string} serviceTypeCode - The code representing the service type for which payment options are requested.
   * @return {Promise<PaymentOptionsByServiceTypeResult>} A promise that resolves to the result containing payment options for the specified service type.
   */
  async execute(serviceTypeCode: string): Promise<PaymentOptionsByServiceTypeResult> {
    return this.service.getPaymentOptionsByServiceType(serviceTypeCode)
  }
}
