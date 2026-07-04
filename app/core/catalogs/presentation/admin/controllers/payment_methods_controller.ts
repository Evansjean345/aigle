import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PaymentMethodsUseCase from '#core/catalogs/application/use_cases/payment_methods.use_case'
import {
  createPaymentMethodValidator,
  paymentMethodValidatorMessage,
  updatePaymentMethodValidator,
} from '#core/catalogs/presentation/admin/validators/payment_method_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

@inject()
/**
 * PaymentMethodsController manages operations related to payment methods,
 * including listing, retrieving, creating, updating, and deleting resources.
 */
export default class PaymentMethodsController {
  /**
   * Constructs an instance of the class.
   *
   * @param {PaymentMethodsUseCase} useCase - The use case instance that handles payment methods business logic.
   */
  constructor(private readonly useCase: PaymentMethodsUseCase) {}

  /**
   * Handles the HTTP request to retrieve a paginated list of resources.
   *
   * @param {Object} ctx - The HTTP context object.
   * @param {object} ctx.request - The request object containing query parameters.
   * @param {object} ctx.response - The response object for sending the result.
   * @param {number} [ctx.request.qs.page=1] - The page number for pagination.
   * @param {number} [ctx.request.qs.limit=20] - The number of items per page.
   * @param {string} [ctx.request.qs.q] - An optional query string for filtering data.
   * @return {Promise<void>} A promise that resolves to the paginated list of resources.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { page = 1, limit = 20, q } = request.qs()
    const result = await this.useCase.list({ page: Number(page), limit: Number(limit), q })
    return response.ok(result)
  }

  /**
   * Retrieves and returns a specific item based on the provided ID parameter.
   *
   * @param {Object} context - The context object containing request parameters and response methods.
   * @param {Object} context.params -*/
  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  /**
   * Handles the request to store a new payment method by validating the input data and creating the resource.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.request - The HTTP request object to validate and retrieve input data.
   * @param {object} context.response - The HTTP response object to send the created resource data.
   * @return {Promise<void>} Returns a promise that resolves to the created payment method resource.
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createPaymentMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(paymentMethodValidatorMessage),
    })

    const created = await this.useCase.create(payload)
    return response.created(created)
  }

  /**
   * Updates a payment method record with the provided data.
   *
   * @param {Object} ctx - The HTTP context object containing request and response information.
   * @param {Object} ctx.params - Parameters from the request URL.
   * @param {Object} ctx.request - The HTTP request object.
   * @param {Object} ctx.response - The HTTP response object.
   * @returns {Promise<void>} A promise that resolves to the updated payment method data.
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updatePaymentMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(paymentMethodValidatorMessage),
      meta: { paymentMethodId: Number(params.id) },
    })

    const item = await this.useCase.update(Number(params.id), payload)
    return response.ok(item)
  }

  /**
   * Deletes a resource identified by its ID from the database.
   *
   * @param {object} HttpContext - The HTTP context object containing request and response data.
   * @param {object} HttpContext.params - The parameters from the HTTP request.
   * @param {string|number} HttpContext.params.id - The unique identifier of the resource to be deleted.
   * @param {object} HttpContext.response - The HTTP response object used to send the response.
   * @return {Promise<void>} The HTTP response object with no content status upon successful deletion.
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
