import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ServiceTypesUseCase from '../use_cases/service_types.use_case.js'
import {
  createServiceTypeValidator,
  createServiceTypeValidatorMessage,
  updateServiceTypeValidator,
} from '#admin/services_management/validators/service_type_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

@inject()
export default class ServiceTypesController {
  /**
   * Constructs an instance of the class with the specified use case.
   *
   * @param {ServiceTypesUseCase} useCase - The use case instance to be used in the class.
   */
  constructor(private readonly useCase: ServiceTypesUseCase) {}

  async index({ request, response }: HttpContext) {
    const { page = 1, limit = 20, q } = request.qs()
    const result = await this.useCase.list({ page: Number(page), limit: Number(limit), q })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  /**
   * Handles storing a new resource by validating the input and invoking the creation use case.
   *
   * @param {Object} httpContext - The HTTP context object.
   * @param {Object} httpContext.request - The HTTP request object.
   * @param {Object} httpContext.response - The HTTP response object.
   * @return {Promise<void>} The created resource.
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createServiceTypeValidator, {
      messagesProvider: new SimpleMessagesProvider(createServiceTypeValidatorMessage),
    })

    const created = await this.useCase.create(payload)
    return response.created(created)
  }

  /**
   * Updates an existing item with provided data based on the given ID.
   *
   * @param {Object} HttpContext - The context object containing parameters, request, and response.
   * @param {Object} HttpContext.params - The parameters object, including the ID of the item to update.
   * @param {Object} HttpContext.request - The request object containing the data to update.
   * @param {Object} HttpContext.response - The response object used to send back the result.
   * @return {Promise<void>} Returns a promise that resolves to the updated item on success or an error response on failure.
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateServiceTypeValidator, {
      meta: { serviceTypeId: Number(params.id) },
      messagesProvider: new SimpleMessagesProvider(createServiceTypeValidatorMessage),
    })

    const item = await this.useCase.update(Number(params.id), payload)
    return response.ok(item)
  }

  /**
   * Deletes a resource identified by its ID and sends a no-content response.
   *
   * @param {Object} context - The context object containing parameters and response.
   * @param {Object} context.params - The parameters object, including resource identifiers.
   * @param {Object} context.response - The response object to send appropriate HTTP responses.
   * @return {Promise<void>} A promise that resolves once the resource is successfully deleted.
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
