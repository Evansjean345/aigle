import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AirtimeService from '#mobile/airtime/services/airtime_service'
import { purchaseAirtimeValidator } from '#mobile/airtime/validators/airtime.validators'

/**
 * Controller for handling operations related to mobile airtime, including purchase,
 * retrieving available airtime countries, fetching country operators, and retrieving operator bundles.
 */
@inject()
export default class MobileAirtimeController {
  /**
   * Creates an instance of the class with the specified AirtimeService.
   *
   * @param {AirtimeService} airtimeService - The service to handle airtime-related operations.
   */
  constructor(private airtimeService: AirtimeService) {}

  async purchase({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(purchaseAirtimeValidator)
    const user = auth.user!!
  }

  // Legacy-wrapped endpoints delegating to existing AirtimeService
  // POST /mobile/airtime
  async airtime({ response, request, auth }: HttpContext) {}

  /**
   * Retrieves a list of available airtime countries and sends the response.
   *
   * @param {HttpContext} param0 - The HTTP context object containing the response.
   * @returns {Promise<void>} A promise that resolves when the response has been sent.
   */
  async countries({ response }: HttpContext): Promise<void> {
    const result = await this.airtimeService.getAirtimeCountries()
    return response.ok(result)
  }

  /**
   * Handles the operation to fetch the country operator using the airtime service.
   *
   * @param {Object} HttpContext - The HTTP context object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  async countryOperator({ response, request, params }: HttpContext): Promise<void> {
    console.log(params)
    console.log(request.qs())

    const result = await this.airtimeService.getCountryOperators(params.country_id, request.qs())
    return response.ok(result)
  }

  /**
   * Retrieves operator bundles for a given country and operator.
   *
   * @param {Object} HttpContext - The context object containing HTTP request and response.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.params - The parameters object containing request data.
   * @param {string} HttpContext.params.country_id - The ID of the country.
   * @param {string} HttpContext.params.operator - The operator for which bundles are being retrieved.
   * @return {Promise<void>} A promise that resolves when the response is sent.
   */
  async operatorBundles({ response, params }: HttpContext): Promise<void> {
    const countryId = params.country_id
    const operator = params.operator

    const result = await this.airtimeService.getBundles(countryId, operator)
    return response.ok(result)
  }
}
