import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ServiceProviderMethodsUseCase from '../use_cases/service_provider_methods.use_case.js'
import {
  createServiceProviderMethodValidator,
  serviceProviderMethodValidatorMessage,
  updateServiceProviderMethodValidator,
} from '#admin/services_management/validators/service_provider_method_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

@inject()
export default class ServiceProviderMethodsController {
  /**
   * Constructs an instance of the class.
   *
   * @param {ServiceProviderMethodsUseCase} useCase - The use case instance associated with service provider methods.
   */
  constructor(private readonly useCase: ServiceProviderMethodsUseCase) {}

  /**
   * Handles the request to list items with optional query parameters for filtering and pagination.
   *
   * @param {Object} context - The HTTP context for the request.
   * @param {Object} context.request - The HTTP request object containing query parameters.
   * @param {Object} context.response - The HTTP response object used to send back the response.
   * @return {Promise<void>} The response object with the list of items and their metadata.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const qs = request.qs()
    const result = await this.useCase.list({
      page: Number(qs.page ?? 1),
      limit: Number(qs.limit ?? 20),
      isActive:
        qs.is_active !== undefined || qs.isActive !== undefined
          ? String(qs.is_active ?? qs.isActive) === 'true' ||
            String(qs.is_active ?? qs.isActive) === '1'
          : undefined,
      serviceTypeId: qs.service_type_id
        ? Number(qs.service_type_id)
        : qs.serviceTypeId
          ? Number(qs.serviceTypeId)
          : undefined,
      paymentMethodId: qs.payment_method_id
        ? Number(qs.payment_method_id)
        : qs.paymentMethodId
          ? Number(qs.paymentMethodId)
          : undefined,
      providerFromId: qs.provider_from_id
        ? Number(qs.provider_from_id)
        : qs.providerFromId
          ? Number(qs.providerFromId)
          : undefined,
    })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createServiceProviderMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(serviceProviderMethodValidatorMessage),
    })

    const created = await this.useCase.create(payload)
    return response.created(created)
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateServiceProviderMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(serviceProviderMethodValidatorMessage),
      meta: { spmId: Number(params.id) },
    })

    const item = await this.useCase.update(Number(params.id), payload)
    return response.ok(item)
  }

  async destroy({ params, response }: HttpContext) {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
