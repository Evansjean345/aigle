import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import {
  createProviderValidator,
  providerValidatorMessage,
  updateProviderValidator,
} from '#admin/services_management/validators/provider_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import ProvidersUseCase from '#admin/services_management/use_cases/providers.use_case'
import { ProviderType } from '#features/appServices/domain/models/provider'

@inject()
export default class ProvidersController {
  /**
   * Creates an instance of the class with the specified ProvidersUseCase.
   *
   * @param {ProvidersUseCase} useCase - The use case instance to be used by the class.
   */
  constructor(private readonly useCase: ProvidersUseCase) {}

  /**
   * Handles the listing of resources based on query parameters from the request.
   *
   * @param {object} ctx - The HTTP context object.
   * @param {object} ctx.request - The HTTP request object containing query parameters.
   * @param {object} ctx.response - The HTTP response object to send the result.
   * @return {Promise<void>} A promise that resolves when the response has been sent.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { page = 1, limit = 20, q, type } = request.qs()
    const result = await this.useCase.list({
      page: Number(page),
      limit: Number(limit),
      q,
      type: type as ProviderType,
    })

    return response.ok(result)
  }

  /**
   * Retrieves and returns an item by its ID.
   *
   * @param {Object} context - The context object.
   * @param {Object} context.params - The route parameters.
   * @param {string} context.params.id - The ID of the item to retrieve.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<Object>} A promise that resolves to the HTTP response containing the requested item.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  /**
   * Stores a new resource based on the provided request data.
   *
   * @param {object} HttpContext - The HTTP context containing the request and response objects.
   * @param {object} HttpContext.request - The HTTP request object.
   * @param {object} HttpContext.response - The HTTP response object.
   * @return {Promise<void>} Returns the created resource as a response.
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createProviderValidator, {
      messagesProvider: new SimpleMessagesProvider(providerValidatorMessage),
    })

    const created = await this.useCase.create(payload)
    return response.created(created)
  }

  /**
   * Updates a resource with the given data and returns the updated resource.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.request - The HTTP request object.
   * @param {Object} context.response - The HTTP response object.
   * @return {void} The updated resource.
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateProviderValidator, {
      messagesProvider: new SimpleMessagesProvider(providerValidatorMessage),
      meta: { providerId: Number(params.id) },
    })

    const item = await this.useCase.update(Number(params.id), payload)
    return response.ok(item)
  }

  /**
   * Deletes a resource identified by the given ID and sends a no content response.
   *
   * @param {Object} HttpContext - The HTTP context object.
   * @param {Object} HttpContext.params - The route parameters containing the ID of the resource to be deleted.
   * @param {Object} HttpContext.response - The HTTP response object used to send the response.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
