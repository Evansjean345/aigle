import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetPaymentOptionsByServiceTypeUseCase from '#core/catalogs/application/use_cases/get_payment_options_by_service_type.use_case'
import GetToPaymentOptionsByServiceTypeUseCase from '#core/catalogs/application/use_cases/get_to_payment_options_by_service_type.use_case'

/**
 * Controller responsible for handling operations related to services and their payment options.
 */
@inject()
export default class ServicesController {
  /**
   * Constructs an instance of the class with the provided use cases.
   *
   * @param {GetPaymentOptionsByServiceTypeUseCase} useCase - The use case responsible for retrieving payment options by service type.
   * @param {GetToPaymentOptionsByServiceTypeUseCase} toUseCase - The use case responsible for retrieving additional payment options by service type.
   */
  constructor(
    private readonly useCase: GetPaymentOptionsByServiceTypeUseCase,
    private readonly toUseCase: GetToPaymentOptionsByServiceTypeUseCase
  ) {}

  /**
   * Retrieves payment options based on the provided service type.
   *
   * @param {Object} context - The HTTP context containing request and response objects.
   * @param {Object} context.params - Contains route parameters from the request.
   * @param {Object} context.params.serviceType - The service type code used to fetch payment options.
   * @param {Object} context.response - The response object used to send the result.
   * @return {Promise<void>} A promise that resolves to the payment options corresponding to the service type.
   */
  async paymentOptionsByServiceType({ params, response }: HttpContext): Promise<void> {
    const serviceTypeCode: string = params.serviceType
    const result = await this.useCase.execute(serviceTypeCode)
    return response.ok(result)
  }

  /**
   * Handles the retrieval of payment options based on the service type and provider code.
   *
   * @param {object} HttpContext - The context object encapsulating the request, response, and route parameters.
   * @param {object} HttpContext.params - The parameters extracted from the route.
   * @param {string} HttpContext.params.serviceType - The code representing the service type.
   * @param {object} HttpContext.request - The request object containing query string and other data.
   * @param {object} HttpContext.response - The response object used to send back the results or errors.
   *
   * @return {Promise<void>} A promise resolving to the payment options if provided successfully or a response object with an error message.
   */
  async paymentOptionsByServiceTypeTo({ params, request, response }: HttpContext): Promise<void> {
    const serviceTypeCode: string = params.serviceType
    const fromProviderCode: string | undefined = request.qs().fromProviderCode

    if (!fromProviderCode) {
      return response.badRequest({
        code: 'FROM_PROVIDER_REQUIRED',
        message: 'fromProviderCode is required',
      })
    }

    const result = await this.toUseCase.execute(serviceTypeCode, fromProviderCode)
    return response.ok(result)
  }
}
